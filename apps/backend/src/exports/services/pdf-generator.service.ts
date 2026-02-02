import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { TDocumentDefinitions, Content, TableCell } from 'pdfmake/interfaces';
import { CompanyInfo } from '../dto/export.dto';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PdfPrinter = require('pdfmake');

/**
 * PDF Generator Service
 * 
 * Generates legally compliant PDF documents for Algerian fiscal exports.
 * Uses pdfmake for server-side PDF generation.
 */
@Injectable()
export class PdfGeneratorService {
  private readonly logger = new Logger(PdfGeneratorService.name);
  private printer: InstanceType<typeof PdfPrinter>;

  // Manchengo company information
  readonly companyInfo: CompanyInfo = {
    name: 'EURL MANCHENGO',
    address: 'Lot 05, grp propriété 342, local n° 01, Ouled Chbel - Alger',
    nif: '002516120492183',  // Numéro d'Identification Fiscale
    nis: '002516360095929',  // Numéro d'Identification Statistique
    rc: '25 B 1204921 16/00',  // Registre de Commerce
    ai: '16350190602',       // Article d'Imposition
    phone: '0661 54 29 14 / 020 089 633',
    email: 'contact@manchengo.dz',
  };

  constructor() {
    // Define fonts for pdfmake - resolve path from project root
    // NestJS compiles to dist/src/exports/services, assets go to dist/assets
    // So we need to go up 4 levels from dist/src/exports/services to dist/assets/fonts
    const distFontsDir = path.join(__dirname, '../../../assets/fonts');
    
    // Fallback to src folder for development  
    const srcFontsDir = path.join(process.cwd(), 'src/assets/fonts');
    
    // Also check dist/assets directly (in case structure varies)
    const distAssetsDirect = path.join(process.cwd(), 'dist/assets/fonts');
    
    // Check which path exists
    let actualFontsDir = srcFontsDir;
    if (fs.existsSync(distFontsDir)) {
      actualFontsDir = distFontsDir;
    } else if (fs.existsSync(distAssetsDirect)) {
      actualFontsDir = distAssetsDirect;
    } else if (!fs.existsSync(srcFontsDir)) {
      this.logger.error(`Fonts not found in any location`);
    }
    
    this.logger.log(`Using fonts from: ${actualFontsDir}`);
    
    const fonts = {
      Roboto: {
        normal: path.join(actualFontsDir, 'Roboto-Regular.ttf'),
        bold: path.join(actualFontsDir, 'Roboto-Medium.ttf'),
        italics: path.join(actualFontsDir, 'Roboto-Italic.ttf'),
        bolditalics: path.join(actualFontsDir, 'Roboto-MediumItalic.ttf'),
      },
    };

    this.printer = new (PdfPrinter as any)(fonts);
  }

  /**
   * Generate PDF buffer from document definition
   */
  async generatePdf(docDefinition: TDocumentDefinitions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        this.logger.log('Creating PDF document...');
        const pdfDoc = this.printer.createPdfKitDocument(docDefinition);
        const chunks: Buffer[] = [];

        pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
        pdfDoc.on('end', () => {
          this.logger.log(`PDF generated successfully, size: ${Buffer.concat(chunks).length} bytes`);
          resolve(Buffer.concat(chunks));
        });
        pdfDoc.on('error', (err: Error) => {
          this.logger.error('PDF generation error:', err);
          reject(err);
        });

        pdfDoc.end();
      } catch (error) {
        this.logger.error('PDF creation failed:', error);
        reject(error);
      }
    });
  }

  /**
   * Format amount from centimes to DA with proper formatting
   * Algerian Dinar uses comma as decimal separator
   */
  formatAmount(centimes: number): string {
    const da = centimes / 100;
    return da.toLocaleString('fr-DZ', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' DA';
  }

  /**
   * Format date for Algerian documents (DD/MM/YYYY)
   */
  formatDate(date: Date): string {
    return date.toLocaleDateString('fr-DZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  /**
   * Format period range for document headers
   */
  formatPeriod(startDate: Date, endDate: Date): string {
    return `Du ${this.formatDate(startDate)} au ${this.formatDate(endDate)}`;
  }

  /**
   * Create standard document header with company info
   */
  createHeader(title: string, period?: string): Content {
    const items: any[] = [
      { text: this.companyInfo.name, style: 'companyName', alignment: 'center' },
      { text: this.companyInfo.address, style: 'companyAddress', alignment: 'center' },
      { text: `NIF: ${this.companyInfo.nif} | RC: ${this.companyInfo.rc}`, style: 'companyFiscal', alignment: 'center' },
      { text: '', margin: [0, 10] },
      { text: title, style: 'documentTitle', alignment: 'center' },
    ];
    if (period) {
      items.push({ text: period, style: 'period', alignment: 'center' });
    }
    items.push({ text: '', margin: [0, 15] });
    return { stack: items } as Content;
  }

  /**
   * Create standard footer with page numbers and generation date
   */
  createFooter(): (currentPage: number, pageCount: number) => Content {
    const generatedAt = new Date().toLocaleString('fr-DZ');
    return (currentPage: number, pageCount: number): Content => ({
      columns: [
        { text: `Généré le ${generatedAt}`, style: 'footer', alignment: 'left' },
        { text: `Page ${currentPage} / ${pageCount}`, style: 'footer', alignment: 'right' },
      ],
      margin: [40, 10],
    });
  }

  /**
   * Standard styles for fiscal documents
   */
  getDefaultStyles(): Record<string, object> {
    return {
      companyName: { fontSize: 16, bold: true, margin: [0, 0, 0, 5] },
      companyAddress: { fontSize: 10, margin: [0, 0, 0, 3] },
      companyFiscal: { fontSize: 9, color: '#666666', margin: [0, 0, 0, 5] },
      documentTitle: { fontSize: 14, bold: true, margin: [0, 0, 0, 5] },
      period: { fontSize: 11, italics: true, margin: [0, 0, 0, 10] },
      tableHeader: { fontSize: 9, bold: true, fillColor: '#f0f0f0' },
      tableCell: { fontSize: 8 },
      tableCellRight: { fontSize: 8, alignment: 'right' },
      totalRow: { fontSize: 9, bold: true, fillColor: '#e0e0e0' },
      footer: { fontSize: 8, color: '#888888' },
      sectionTitle: { fontSize: 11, bold: true, margin: [0, 15, 0, 5] },
    };
  }

  /**
   * Create a table cell with right alignment (for amounts)
   */
  amountCell(amount: number): TableCell {
    return { text: this.formatAmount(amount), style: 'tableCellRight' };
  }

  /**
   * Create a table cell with default styling
   */
  textCell(text: string): TableCell {
    return { text, style: 'tableCell' };
  }
}
