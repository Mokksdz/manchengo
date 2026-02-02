import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { ExcelGeneratorService } from './excel-generator.service';
import { VatJournalEntry, ExportFormat } from '../dto/export.dto';
import { TDocumentDefinitions } from 'pdfmake/interfaces';

/**
 * VAT Journal Service (Journal de TVA)
 * 
 * Generates the TVA declaration support document for Algerian tax authorities.
 * Required for monthly G50 declarations.
 * 
 * Algerian TVA rate: 19% (standard rate)
 * 
 * Legal requirements:
 * - Per-invoice breakdown of HT and TVA
 * - Total HT and Total TVA for the period
 * - Client NIF for fiscal traceability
 */
@Injectable()
export class VatJournalService {
  // Standard TVA rate in Algeria
  private readonly TVA_RATE = 19;

  constructor(
    private prisma: PrismaService,
    private pdfGenerator: PdfGeneratorService,
    private excelGenerator: ExcelGeneratorService,
  ) {}

  /**
   * Fetch VAT journal entries for a date range
   * READ-ONLY: No modifications to invoice data
   */
  async getEntries(startDate: Date, endDate: Date): Promise<VatJournalEntry[]> {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        client: {
          select: {
            name: true,
            nif: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return invoices.map((inv) => ({
      date: inv.createdAt,
      invoiceRef: inv.reference,
      clientName: inv.client.name,
      clientNif: inv.client.nif,
      amountHt: inv.totalHt,
      tvaRate: this.TVA_RATE,
      amountTva: inv.totalTva,
    }));
  }

  /**
   * Calculate totals for G50 declaration
   */
  private calculateTotals(entries: VatJournalEntry[]) {
    return entries.reduce(
      (acc, entry) => ({
        totalHt: acc.totalHt + entry.amountHt,
        totalTva: acc.totalTva + entry.amountTva,
      }),
      { totalHt: 0, totalTva: 0 },
    );
  }

  /**
   * Generate export in requested format
   */
  async generate(
    startDate: Date,
    endDate: Date,
    format: ExportFormat,
  ): Promise<Buffer> {
    const entries = await this.getEntries(startDate, endDate);

    if (format === ExportFormat.EXCEL) {
      return this.generateExcel(entries, startDate, endDate);
    }
    return this.generatePdf(entries, startDate, endDate);
  }

  /**
   * Generate PDF version of VAT journal
   */
  private async generatePdf(
    entries: VatJournalEntry[],
    startDate: Date,
    endDate: Date,
  ): Promise<Buffer> {
    const totals = this.calculateTotals(entries);
    const period = this.pdfGenerator.formatPeriod(startDate, endDate);

    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageOrientation: 'portrait',
      pageMargins: [40, 60, 40, 60],
      header: this.pdfGenerator.createHeader('JOURNAL DE TVA', period),
      footer: this.pdfGenerator.createFooter(),
      content: [
        // TVA rate note
        {
          text: `Taux de TVA applicable: ${this.TVA_RATE}%`,
          style: 'sectionTitle',
          margin: [0, 0, 0, 10],
        },
        {
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', '*', 'auto', 'auto', 'auto'],
            body: [
              // Header row
              [
                { text: 'Date', style: 'tableHeader' },
                { text: 'N° Facture', style: 'tableHeader' },
                { text: 'Client', style: 'tableHeader' },
                { text: 'NIF Client', style: 'tableHeader' },
                { text: 'Base HT', style: 'tableHeader' },
                { text: 'TVA 19%', style: 'tableHeader' },
              ],
              // Data rows
              ...entries.map((entry) => [
                this.pdfGenerator.textCell(this.pdfGenerator.formatDate(entry.date)),
                this.pdfGenerator.textCell(entry.invoiceRef),
                this.pdfGenerator.textCell(entry.clientName),
                this.pdfGenerator.textCell(entry.clientNif || '-'),
                this.pdfGenerator.amountCell(entry.amountHt),
                this.pdfGenerator.amountCell(entry.amountTva),
              ]),
              // Totals row
              [
                { text: 'TOTAUX PÉRIODE', style: 'totalRow', colSpan: 4 },
                {},
                {},
                {},
                { text: this.pdfGenerator.formatAmount(totals.totalHt), style: 'totalRow', alignment: 'right' },
                { text: this.pdfGenerator.formatAmount(totals.totalTva), style: 'totalRow', alignment: 'right' },
              ],
            ],
          },
        },
        // G50 Summary box
        {
          margin: [0, 20, 0, 0],
          table: {
            widths: ['*', 'auto'],
            body: [
              [
                { text: 'RÉCAPITULATIF POUR DÉCLARATION G50', style: 'tableHeader', colSpan: 2 },
                {},
              ],
              [
                { text: 'Total Chiffre d\'Affaires HT:', style: 'tableCell' },
                { text: this.pdfGenerator.formatAmount(totals.totalHt), style: 'tableCellRight', bold: true },
              ],
              [
                { text: 'Total TVA Collectée (19%):', style: 'tableCell' },
                { text: this.pdfGenerator.formatAmount(totals.totalTva), style: 'tableCellRight', bold: true },
              ],
            ],
          },
        },
        // Invoice count
        {
          text: `\nNombre de factures: ${entries.length}`,
          margin: [0, 10, 0, 0],
        },
      ],
      styles: this.pdfGenerator.getDefaultStyles(),
      defaultStyle: { font: 'Roboto' },
    };

    return this.pdfGenerator.generatePdf(docDefinition);
  }

  /**
   * Generate Excel version of VAT journal
   */
  private async generateExcel(
    entries: VatJournalEntry[],
    startDate: Date,
    endDate: Date,
  ): Promise<Buffer> {
    const totals = this.calculateTotals(entries);
    const workbook = this.excelGenerator.createWorkbook();
    const worksheet = workbook.addWorksheet('Journal TVA');

    // Add header
    const period = this.excelGenerator.formatPeriod(startDate, endDate);
    this.excelGenerator.addHeader(worksheet, 'JOURNAL DE TVA', period, 6);

    // Column headers (row 6)
    const headerRow = worksheet.getRow(6);
    headerRow.values = [
      'Date',
      'N° Facture',
      'Client',
      'NIF Client',
      'Base HT',
      'TVA 19%',
    ];
    this.excelGenerator.styleHeaderRow(headerRow);

    // Data rows
    let rowIndex = 7;
    for (const entry of entries) {
      const row = worksheet.getRow(rowIndex);
      row.values = [
        this.excelGenerator.formatDate(entry.date),
        entry.invoiceRef,
        entry.clientName,
        entry.clientNif || '-',
        this.excelGenerator.formatAmount(entry.amountHt),
        this.excelGenerator.formatAmount(entry.amountTva),
      ];
      rowIndex++;
    }

    // Totals row
    const totalRow = worksheet.getRow(rowIndex);
    totalRow.values = [
      'TOTAUX PÉRIODE',
      '',
      '',
      '',
      this.excelGenerator.formatAmount(totals.totalHt),
      this.excelGenerator.formatAmount(totals.totalTva),
    ];
    this.excelGenerator.styleTotalRow(totalRow);

    // G50 Summary (separate section)
    rowIndex += 2;
    worksheet.getRow(rowIndex).values = ['RÉCAPITULATIF G50'];
    worksheet.getRow(rowIndex).font = { bold: true };
    rowIndex++;
    worksheet.getRow(rowIndex).values = ['Total CA HT:', this.excelGenerator.formatAmount(totals.totalHt)];
    rowIndex++;
    worksheet.getRow(rowIndex).values = ['Total TVA:', this.excelGenerator.formatAmount(totals.totalTva)];

    // Apply amount formatting
    this.excelGenerator.applyAmountFormat(worksheet, 5);
    this.excelGenerator.applyAmountFormat(worksheet, 6);

    // Auto-fit columns
    this.excelGenerator.autoFitColumns(worksheet);

    return this.excelGenerator.generateBuffer(workbook);
  }
}
