import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { ExcelGeneratorService } from './excel-generator.service';
import { StampDutyEntry, ExportFormat } from '../dto/export.dto';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { PaymentMethod } from '@prisma/client';

/**
 * Stamp Duty Journal Service (Journal du Timbre Fiscal)
 * 
 * Generates stamp duty report for Algerian fiscal compliance.
 * 
 * Algerian Stamp Duty (Timbre Fiscal) Rules (2025):
 * - Applies ONLY to cash payments (espèces)
 * - Rate: 1% of TTC amount
 * - Minimum: 5 DA, Maximum: 2500 DA per invoice
 * 
 * Legal requirements:
 * - Only cash invoices included
 * - Show TTC, rate, and stamp amount
 * - Period totals for fiscal declaration
 */
@Injectable()
export class StampDutyService {
  // Stamp duty rate (1%)
  private readonly STAMP_RATE = 0.01;
  
  // Cash payment methods that require stamp duty
  private readonly CASH_METHODS: PaymentMethod[] = [PaymentMethod.ESPECES];

  constructor(
    private prisma: PrismaService,
    private pdfGenerator: PdfGeneratorService,
    private excelGenerator: ExcelGeneratorService,
  ) {}

  /**
   * Fetch stamp duty entries for a date range
   * Only cash invoices are subject to stamp duty
   * READ-ONLY: No modifications to invoice data
   */
  async getEntries(startDate: Date, endDate: Date): Promise<StampDutyEntry[]> {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        // Only cash payments
        paymentMethod: {
          in: this.CASH_METHODS,
        },
        // Only invoices with stamp duty applied
        timbreFiscal: {
          gt: 0,
        },
      },
      include: {
        client: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return invoices.map((inv) => ({
      date: inv.createdAt,
      invoiceRef: inv.reference,
      clientName: inv.client.name,
      amountTtc: inv.totalTtc,
      stampRate: this.STAMP_RATE,
      stampAmount: inv.timbreFiscal,
    }));
  }

  /**
   * Calculate totals for the period
   */
  private calculateTotals(entries: StampDutyEntry[]) {
    return entries.reduce(
      (acc, entry) => ({
        totalTtc: acc.totalTtc + entry.amountTtc,
        totalStamp: acc.totalStamp + entry.stampAmount,
      }),
      { totalTtc: 0, totalStamp: 0 },
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
   * Generate PDF version of stamp duty journal
   */
  private async generatePdf(
    entries: StampDutyEntry[],
    startDate: Date,
    endDate: Date,
  ): Promise<Buffer> {
    const totals = this.calculateTotals(entries);
    const period = this.pdfGenerator.formatPeriod(startDate, endDate);

    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageOrientation: 'portrait',
      pageMargins: [40, 60, 40, 60],
      header: this.pdfGenerator.createHeader('JOURNAL DU TIMBRE FISCAL', period),
      footer: this.pdfGenerator.createFooter(),
      content: [
        // Legal note
        {
          text: 'Timbre fiscal applicable aux paiements en espèces uniquement',
          style: 'sectionTitle',
          margin: [0, 0, 0, 5],
        },
        {
          text: `Taux applicable: ${this.STAMP_RATE * 100}% du TTC`,
          italics: true,
          fontSize: 9,
          margin: [0, 0, 0, 15],
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
                { text: 'Montant TTC', style: 'tableHeader' },
                { text: 'Taux', style: 'tableHeader' },
                { text: 'Timbre', style: 'tableHeader' },
              ],
              // Data rows
              ...entries.map((entry) => [
                this.pdfGenerator.textCell(this.pdfGenerator.formatDate(entry.date)),
                this.pdfGenerator.textCell(entry.invoiceRef),
                this.pdfGenerator.textCell(entry.clientName),
                this.pdfGenerator.amountCell(entry.amountTtc),
                this.pdfGenerator.textCell(`${entry.stampRate * 100}%`),
                this.pdfGenerator.amountCell(entry.stampAmount),
              ]),
              // Totals row
              [
                { text: 'TOTAUX', style: 'totalRow', colSpan: 3 },
                {},
                {},
                { text: this.pdfGenerator.formatAmount(totals.totalTtc), style: 'totalRow', alignment: 'right' },
                { text: '', style: 'totalRow' },
                { text: this.pdfGenerator.formatAmount(totals.totalStamp), style: 'totalRow', alignment: 'right' },
              ],
            ],
          },
        },
        // Summary
        {
          margin: [0, 20, 0, 0],
          table: {
            widths: ['*', 'auto'],
            body: [
              [
                { text: 'RÉCAPITULATIF TIMBRE FISCAL', style: 'tableHeader', colSpan: 2 },
                {},
              ],
              [
                { text: 'Nombre de factures en espèces:', style: 'tableCell' },
                { text: entries.length.toString(), style: 'tableCellRight', bold: true },
              ],
              [
                { text: 'Total TTC des ventes en espèces:', style: 'tableCell' },
                { text: this.pdfGenerator.formatAmount(totals.totalTtc), style: 'tableCellRight', bold: true },
              ],
              [
                { text: 'Total Timbre Fiscal collecté:', style: 'tableCell' },
                { text: this.pdfGenerator.formatAmount(totals.totalStamp), style: 'tableCellRight', bold: true },
              ],
            ],
          },
        },
      ],
      styles: this.pdfGenerator.getDefaultStyles(),
      defaultStyle: { font: 'Roboto' },
    };

    return this.pdfGenerator.generatePdf(docDefinition);
  }

  /**
   * Generate Excel version of stamp duty journal
   */
  private async generateExcel(
    entries: StampDutyEntry[],
    startDate: Date,
    endDate: Date,
  ): Promise<Buffer> {
    const totals = this.calculateTotals(entries);
    const workbook = this.excelGenerator.createWorkbook();
    const worksheet = workbook.addWorksheet('Journal Timbre Fiscal');

    // Add header
    const period = this.excelGenerator.formatPeriod(startDate, endDate);
    this.excelGenerator.addHeader(worksheet, 'JOURNAL DU TIMBRE FISCAL', period, 6);

    // Column headers (row 6)
    const headerRow = worksheet.getRow(6);
    headerRow.values = [
      'Date',
      'N° Facture',
      'Client',
      'Montant TTC',
      'Taux',
      'Timbre',
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
        this.excelGenerator.formatAmount(entry.amountTtc),
        `${entry.stampRate * 100}%`,
        this.excelGenerator.formatAmount(entry.stampAmount),
      ];
      rowIndex++;
    }

    // Totals row
    const totalRow = worksheet.getRow(rowIndex);
    totalRow.values = [
      'TOTAUX',
      '',
      '',
      this.excelGenerator.formatAmount(totals.totalTtc),
      '',
      this.excelGenerator.formatAmount(totals.totalStamp),
    ];
    this.excelGenerator.styleTotalRow(totalRow);

    // Apply amount formatting
    this.excelGenerator.applyAmountFormat(worksheet, 4);
    this.excelGenerator.applyAmountFormat(worksheet, 6);

    // Auto-fit columns
    this.excelGenerator.autoFitColumns(worksheet);

    return this.excelGenerator.generateBuffer(workbook);
  }
}
