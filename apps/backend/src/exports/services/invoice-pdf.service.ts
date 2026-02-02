import { Injectable, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Invoice PDF Service
 * 
 * Generates individual invoice PDFs with legal Algerian formatting.
 * Compliant with Algerian fiscal requirements (TVA 19%, Timbre fiscal dynamique).
 */
@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);

  constructor(
    private prisma: PrismaService,
    private pdfGenerator: PdfGeneratorService,
  ) {}

  /**
   * Get invoice reference for filename
   */
  async getInvoiceReference(invoiceId: number): Promise<{ reference: string } | null> {
    return this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { reference: true },
    });
  }

  /**
   * Generate PDF for a specific invoice
   */
  async generate(invoiceId: number): Promise<Buffer> {
    try {
      this.logger.log(`Loading invoice #${invoiceId} from database...`);
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          client: true,
          lines: {
            include: {
              productPf: true,
            },
          },
        },
      });

      if (!invoice) {
        throw new NotFoundException(`Facture #${invoiceId} non trouvée`);
      }

      this.logger.log(`Invoice found: ${invoice.reference}, generating PDF...`);
      return await this.generatePdf(invoice);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      // Log the full error stack for debugging
      this.logger.error(`Erreur génération PDF facture #${invoiceId}:`, error instanceof Error ? error.stack : error);
      throw new InternalServerErrorException(`Erreur lors de la génération du PDF de la facture #${invoiceId}`);
    }
  }

  /**
   * Generate the invoice PDF document
   */
  private async generatePdf(invoice: any): Promise<Buffer> {
    this.logger.log(`Generating PDF for invoice: ${invoice.reference}`);
    
    const company = this.pdfGenerator.companyInfo;
    const ref = invoice.reference || 'N/A';
    const invoiceDate = invoice.date ? new Date(invoice.date) : new Date();
    const clientName = invoice.client?.name || 'Client inconnu';
    const clientAddress = invoice.client?.address || '';
    const clientNif = invoice.client?.nif || '';
    
    // Build table body with invoice lines
    const tableBody: any[][] = [
      [
        { text: '#', bold: true, fillColor: '#f0f0f0' },
        { text: 'Désignation', bold: true, fillColor: '#f0f0f0' },
        { text: 'Qté', bold: true, fillColor: '#f0f0f0' },
        { text: 'PU HT', bold: true, fillColor: '#f0f0f0' },
        { text: 'Total HT', bold: true, fillColor: '#f0f0f0' },
      ],
    ];
    
    // Add lines safely
    if (invoice.lines && Array.isArray(invoice.lines)) {
      invoice.lines.forEach((line: any, i: number) => {
        tableBody.push([
          (i + 1).toString(),
          line.productPf?.name || 'Article',
          String(line.quantity || 0),
          this.pdfGenerator.formatAmount(line.unitPriceHt || 0),
          this.pdfGenerator.formatAmount(line.lineHt || 0),
        ]);
      });
    }

    // Charger le logo SVG
    const logoPath = path.join(process.cwd(), 'src/assets/logo_manchengo.svg');
    const distLogoPath = path.join(process.cwd(), 'dist/assets/logo_manchengo.svg');
    let logoSvg = '';
    if (fs.existsSync(distLogoPath)) {
      logoSvg = fs.readFileSync(distLogoPath, 'utf8');
    } else if (fs.existsSync(logoPath)) {
      logoSvg = fs.readFileSync(logoPath, 'utf8');
    }

    // Client fiscal info
    const clientRc = invoice.client?.rc || '';
    const clientAi = invoice.client?.ai || '';
    const clientNis = invoice.client?.nis || '';
    const clientPhone = invoice.client?.phone || '';

    // Build content array
    const content: any[] = [];
    
    // Header: Logo left, Company info right
    content.push({
      columns: [
        // Left: Logo
        logoSvg 
          ? { svg: logoSvg, width: 100, margin: [0, 0, 0, 0] }
          : { text: '', width: 100 },
        // Right: Company info
        {
          width: '*',
          alignment: 'right',
          stack: [
            { text: company.name, fontSize: 14, bold: true, color: '#1a1a1a' },
            { text: company.address, fontSize: 9, margin: [0, 3, 0, 0] },
            { text: `RC: ${company.rc}`, fontSize: 8, color: '#666666' },
            { text: `NIF: ${company.nif}`, fontSize: 8, color: '#666666' },
            { text: `AI: ${company.ai} | NIS: ${company.nis}`, fontSize: 8, color: '#666666' },
            { text: `Tél: ${company.phone}`, fontSize: 8, color: '#666666' },
          ],
        },
      ],
      margin: [0, 0, 0, 15],
    });

    // Separator line
    content.push({
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#e0e0e0' }],
      margin: [0, 5, 0, 15],
    });
      
    // Invoice title
    content.push(
      { text: `FACTURE N° ${ref}`, fontSize: 18, bold: true, alignment: 'center', margin: [0, 0, 0, 5] },
      { text: `Date: ${this.pdfGenerator.formatDate(invoiceDate)}`, fontSize: 10, alignment: 'center', margin: [0, 0, 0, 20] },
    );
      
    // Client info box
    const clientInfoStack: any[] = [
      { text: 'CLIENT', fontSize: 8, bold: true, color: '#888888', margin: [0, 0, 0, 5] },
      { text: clientName, fontSize: 12, bold: true },
    ];
    
    if (clientAddress) {
      clientInfoStack.push({ text: clientAddress, fontSize: 10, margin: [0, 3, 0, 0] });
    }
    if (clientPhone) {
      clientInfoStack.push({ text: `Tél: ${clientPhone}`, fontSize: 9, color: '#666666', margin: [0, 3, 0, 0] });
    }
    
    // Client fiscal info
    const fiscalLines: string[] = [];
    if (clientRc) fiscalLines.push(`RC: ${clientRc}`);
    if (clientNif) fiscalLines.push(`NIF: ${clientNif}`);
    if (clientAi) fiscalLines.push(`AI: ${clientAi}`);
    if (clientNis) fiscalLines.push(`NIS: ${clientNis}`);
    
    if (fiscalLines.length > 0) {
      clientInfoStack.push({ text: fiscalLines.join(' | '), fontSize: 8, color: '#666666', margin: [0, 5, 0, 0] });
    }

    content.push({
      table: {
        widths: ['*'],
        body: [[{ stack: clientInfoStack, margin: [10, 10, 10, 10] }]],
      },
      layout: {
        hLineWidth: () => 1,
        vLineWidth: () => 1,
        hLineColor: () => '#e0e0e0',
        vLineColor: () => '#e0e0e0',
      },
      margin: [0, 0, 0, 20],
    });
    
    // Lines table
    content.push({
      margin: [0, 20, 0, 0],
      table: {
        headerRows: 1,
        widths: ['auto', '*', 'auto', 'auto', 'auto'],
        body: tableBody,
      },
    });
    
    // Totals
    content.push({ text: '', margin: [0, 10, 0, 0] });
    content.push({ text: `Total HT: ${this.pdfGenerator.formatAmount(invoice.totalHt || 0)}`, fontSize: 10, alignment: 'right' });
    content.push({ text: `TVA (19%): ${this.pdfGenerator.formatAmount(invoice.totalTva || 0)}`, fontSize: 10, alignment: 'right' });
    
    if (invoice.timbreFiscal > 0) {
      content.push({ 
        text: `Timbre fiscal (${this.calculateTimbreRate(invoice.totalTtc || 0)}%): ${this.pdfGenerator.formatAmount(invoice.timbreFiscal)}`, 
        fontSize: 10, 
        alignment: 'right' 
      });
    }
    
    content.push({ text: `NET À PAYER: ${this.pdfGenerator.formatAmount(invoice.netToPay || 0)}`, fontSize: 14, bold: true, alignment: 'right', margin: [0, 10, 0, 0] });
    
    // Payment method
    content.push({ text: `Mode de paiement: ${this.translatePaymentMethod(invoice.paymentMethod || 'ESPECES')}`, fontSize: 10, margin: [0, 20, 0, 0] });
    
    // Amount in words
    content.push({ text: `Arrêtée à la somme de: ${this.amountInWords(invoice.netToPay || 0)}`, fontSize: 9, italics: true, margin: [0, 10, 0, 0] });
    
    // Legal notice
    content.push({ text: 'TVA 19% | Timbre fiscal selon législation algérienne (1% ≤30k, 1.5% ≤100k, 2% >100k DA)', fontSize: 7, color: '#888888', margin: [0, 30, 0, 0] });

    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 60],
      content,
      defaultStyle: { font: 'Roboto' },
    };

    return this.pdfGenerator.generatePdf(docDefinition);
  }

  /**
   * Calcule le taux de timbre fiscal selon la législation algérienne (display %)
   * Input: totalTtc en centimes
   * - TTC ≤ 30 000 DA (3 000 000 centimes) → 1%
   * - 30 000 < TTC ≤ 100 000 DA (10 000 000 centimes) → 1.5%
   * - TTC > 100 000 DA → 2%
   */
  private calculateTimbreRate(totalTtc: number): number {
    if (totalTtc <= 3000000) return 1;      // ≤ 30,000 DA in centimes
    if (totalTtc <= 10000000) return 1.5;   // ≤ 100,000 DA in centimes
    return 2;
  }

  private translatePaymentMethod(method: string): string {
    const t: Record<string, string> = {
      ESPECES: 'Espèces',
      CHEQUE: 'Chèque',
      VIREMENT: 'Virement bancaire',
    };
    return t[method] || method;
  }

  // V23: Handle centimes in amount-in-words for fiscal compliance
  private amountInWords(centimes: number): string {
    const da = Math.floor(centimes / 100);
    const cts = centimes % 100;
    let result = '';

    if (da < 1000) {
      result = `${da}`;
    } else if (da < 1000000) {
      const thousands = Math.floor(da / 1000);
      const remainder = da % 1000;
      result = remainder === 0
        ? `${thousands} mille`
        : `${thousands} mille ${remainder}`;
    } else {
      const millions = Math.floor(da / 1000000);
      const rest = da % 1000000;
      const thousands = Math.floor(rest / 1000);
      const remainder = rest % 1000;
      result = `${millions} million`;
      if (thousands > 0) result += ` ${thousands} mille`;
      if (remainder > 0) result += ` ${remainder}`;
    }

    result += ' dinars algériens';
    if (cts > 0) {
      result += ` et ${cts} centimes`;
    }
    return result;
  }
}
