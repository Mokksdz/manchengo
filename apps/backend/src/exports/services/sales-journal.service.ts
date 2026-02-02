import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { ExcelGeneratorService } from './excel-generator.service';
import { SalesJournalEntry, ExportFormat } from '../dto/export.dto';
import { TDocumentDefinitions } from 'pdfmake/interfaces';

/**
 * Sales Journal Service (Journal des Ventes)
 * 
 * Generates the official sales journal required by Algerian tax authorities.
 * Lists all invoices for a given period with fiscal totals.
 * 
 * Legal requirements:
 * - One line per invoice
 * - Invoice reference, date, client info
 * - HT, TVA, Timbre, TTC amounts
 * - Period totals at bottom
 */
@Injectable()
export class SalesJournalService {
  constructor(
    private prisma: PrismaService,
    private pdfGenerator: PdfGeneratorService,
    private excelGenerator: ExcelGeneratorService,
  ) {}

  /**
   * Fetch sales journal entries for a date range
   * READ-ONLY: No modifications to invoice data
   */
  async getEntries(startDate: Date, endDate: Date): Promise<SalesJournalEntry[]> {
    // V15+V22: Filter by invoice date (not createdAt) and exclude CANCELLED
    const invoices = await this.prisma.invoice.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
        status: { not: 'CANCELLED' },
      },
      include: {
        client: {
          select: {
            name: true,
            nif: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    return invoices.map((inv) => ({
      date: inv.date,
      invoiceRef: inv.reference,
      clientName: inv.client.name,
      clientNif: inv.client.nif,
      amountHt: inv.totalHt,
      amountTva: inv.totalTva,
      amountTimbre: inv.timbreFiscal,
      amountTtc: inv.totalTtc,
      paymentMethod: inv.paymentMethod,
    }));
  }

  /**
   * Calculate totals for the journal
   */
  private calculateTotals(entries: SalesJournalEntry[]) {
    return entries.reduce(
      (acc, entry) => ({
        totalHt: acc.totalHt + entry.amountHt,
        totalTva: acc.totalTva + entry.amountTva,
        totalTimbre: acc.totalTimbre + entry.amountTimbre,
        totalTtc: acc.totalTtc + entry.amountTtc,
      }),
      { totalHt: 0, totalTva: 0, totalTimbre: 0, totalTtc: 0 },
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
   * Generate PDF version of sales journal
   */
  private async generatePdf(
    entries: SalesJournalEntry[],
    startDate: Date,
    endDate: Date,
  ): Promise<Buffer> {
    const totals = this.calculateTotals(entries);
    const period = this.pdfGenerator.formatPeriod(startDate, endDate);

    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [40, 60, 40, 60],
      header: this.pdfGenerator.createHeader('JOURNAL DES VENTES', period),
      footer: this.pdfGenerator.createFooter(),
      content: [
        {
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
            body: [
              // Header row
              [
                { text: 'Date', style: 'tableHeader' },
                { text: 'N° Facture', style: 'tableHeader' },
                { text: 'Client', style: 'tableHeader' },
                { text: 'NIF Client', style: 'tableHeader' },
                { text: 'Montant HT', style: 'tableHeader' },
                { text: 'TVA 19%', style: 'tableHeader' },
                { text: 'Timbre', style: 'tableHeader' },
                { text: 'Total TTC', style: 'tableHeader' },
                { text: 'Paiement', style: 'tableHeader' },
              ],
              // Data rows
              ...entries.map((entry) => [
                this.pdfGenerator.textCell(this.pdfGenerator.formatDate(entry.date)),
                this.pdfGenerator.textCell(entry.invoiceRef),
                this.pdfGenerator.textCell(entry.clientName),
                this.pdfGenerator.textCell(entry.clientNif || '-'),
                this.pdfGenerator.amountCell(entry.amountHt),
                this.pdfGenerator.amountCell(entry.amountTva),
                this.pdfGenerator.amountCell(entry.amountTimbre),
                this.pdfGenerator.amountCell(entry.amountTtc),
                this.pdfGenerator.textCell(entry.paymentMethod),
              ]),
              // Totals row
              [
                { text: 'TOTAUX', style: 'totalRow', colSpan: 4 },
                {},
                {},
                {},
                { text: this.pdfGenerator.formatAmount(totals.totalHt), style: 'totalRow', alignment: 'right' },
                { text: this.pdfGenerator.formatAmount(totals.totalTva), style: 'totalRow', alignment: 'right' },
                { text: this.pdfGenerator.formatAmount(totals.totalTimbre), style: 'totalRow', alignment: 'right' },
                { text: this.pdfGenerator.formatAmount(totals.totalTtc), style: 'totalRow', alignment: 'right' },
                { text: '', style: 'totalRow' },
              ],
            ],
          },
        },
        // Summary
        {
          text: `\nNombre de factures: ${entries.length}`,
          style: 'sectionTitle',
          margin: [0, 20, 0, 0],
        },
      ],
      styles: this.pdfGenerator.getDefaultStyles(),
      defaultStyle: { font: 'Roboto' },
    };

    return this.pdfGenerator.generatePdf(docDefinition);
  }

  /**
   * Generate Excel version of sales journal
   */
  private async generateExcel(
    entries: SalesJournalEntry[],
    startDate: Date,
    endDate: Date,
  ): Promise<Buffer> {
    const totals = this.calculateTotals(entries);
    const workbook = this.excelGenerator.createWorkbook();
    const worksheet = workbook.addWorksheet('Journal des Ventes');

    // Add header
    const period = this.excelGenerator.formatPeriod(startDate, endDate);
    this.excelGenerator.addHeader(worksheet, 'JOURNAL DES VENTES', period, 9);

    // Column headers (row 6)
    const headerRow = worksheet.getRow(6);
    headerRow.values = [
      'Date',
      'N° Facture',
      'Client',
      'NIF Client',
      'Montant HT',
      'TVA 19%',
      'Timbre',
      'Total TTC',
      'Paiement',
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
        this.excelGenerator.formatAmount(entry.amountTimbre),
        this.excelGenerator.formatAmount(entry.amountTtc),
        entry.paymentMethod,
      ];
      rowIndex++;
    }

    // Totals row
    const totalRow = worksheet.getRow(rowIndex);
    totalRow.values = [
      'TOTAUX',
      '',
      '',
      '',
      this.excelGenerator.formatAmount(totals.totalHt),
      this.excelGenerator.formatAmount(totals.totalTva),
      this.excelGenerator.formatAmount(totals.totalTimbre),
      this.excelGenerator.formatAmount(totals.totalTtc),
      '',
    ];
    this.excelGenerator.styleTotalRow(totalRow);

    // Apply amount formatting
    this.excelGenerator.applyAmountFormat(worksheet, 5);
    this.excelGenerator.applyAmountFormat(worksheet, 6);
    this.excelGenerator.applyAmountFormat(worksheet, 7);
    this.excelGenerator.applyAmountFormat(worksheet, 8);

    // Auto-fit columns
    this.excelGenerator.autoFitColumns(worksheet);

    return this.excelGenerator.generateBuffer(workbook);
  }
}
