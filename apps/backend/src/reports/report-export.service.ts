/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * REPORT EXPORT SERVICE — PDF & Excel Export for Reports Module
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Generates downloadable PDF and Excel files from report data.
 * Uses pdfmake for PDF and exceljs for Excel generation.
 *
 * SUPPORTED REPORT TYPES:
 * - stock-valorization: Stock valorization (FIFO)
 * - stock-movements: Stock movements history
 * - production: Production performance
 * - purchase-orders: Purchase orders
 * - suppliers: Supplier performance
 * - sales: Sales report
 *
 * @version 1.0.0
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ReportsService, ReportFilters, ReportResult } from './reports.service';
import * as ExcelJS from 'exceljs';
import { TDocumentDefinitions, TableCell, Content } from 'pdfmake/interfaces';
import * as path from 'path';
import * as fs from 'fs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PdfPrinter = require('pdfmake');

export type ReportType =
  | 'stock-valorization'
  | 'stock-movements'
  | 'production'
  | 'purchase-orders'
  | 'suppliers'
  | 'sales';

export interface ExportResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

@Injectable()
export class ReportExportService {
  private readonly logger = new Logger(ReportExportService.name);
  private printer: InstanceType<typeof PdfPrinter>;

  private readonly companyInfo = {
    name: 'EURL MANCHENGO',
    nif: '002516120492183',
    rc: '25 B 1204921 16/00',
  };

  constructor(private readonly reportsService: ReportsService) {
    // Initialize PDF printer with fonts
    const srcFontsDir = path.join(process.cwd(), 'src/assets/fonts');
    const distFontsDir = path.join(__dirname, '../../../assets/fonts');
    const distAssetsDirect = path.join(process.cwd(), 'dist/assets/fonts');

    let actualFontsDir = srcFontsDir;
    if (fs.existsSync(distFontsDir)) {
      actualFontsDir = distFontsDir;
    } else if (fs.existsSync(distAssetsDirect)) {
      actualFontsDir = distAssetsDirect;
    }

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

  // ═══════════════════════════════════════════════════════════════════════════════
  // PUBLIC METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Export a report to Excel format
   */
  async exportToExcel(reportType: ReportType, filters: ReportFilters): Promise<ExportResult> {
    this.logger.log(`Generating Excel report: ${reportType}`);
    const reportData = await this.fetchReportData(reportType, filters);
    const buffer = await this.generateExcel(reportType, reportData, filters);
    const dateStr = filters.startDate.toISOString().split('T')[0];

    return {
      buffer,
      filename: `rapport_${reportType}_${dateStr}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  /**
   * Export a report to PDF format
   */
  async exportToPdf(reportType: ReportType, filters: ReportFilters): Promise<ExportResult> {
    this.logger.log(`Generating PDF report: ${reportType}`);
    const reportData = await this.fetchReportData(reportType, filters);
    const buffer = await this.generatePdf(reportType, reportData, filters);
    const dateStr = filters.startDate.toISOString().split('T')[0];

    return {
      buffer,
      filename: `rapport_${reportType}_${dateStr}.pdf`,
      contentType: 'application/pdf',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // DATA FETCHING
  // ═══════════════════════════════════════════════════════════════════════════════

  private async fetchReportData(reportType: ReportType, filters: ReportFilters): Promise<ReportResult<any>> {
    switch (reportType) {
      case 'stock-valorization':
        return this.reportsService.getStockValorizationReport();
      case 'stock-movements':
        return this.reportsService.getStockMovementReport(filters);
      case 'production':
        return this.reportsService.getProductionReport(filters);
      case 'purchase-orders':
        return this.reportsService.getPurchaseOrdersReport(filters);
      case 'suppliers':
        return this.reportsService.getSupplierPerformanceReport(filters);
      case 'sales':
        return this.reportsService.getSalesReport(filters);
      default:
        throw new BadRequestException(`Type de rapport inconnu: ${reportType}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // EXCEL GENERATION
  // ═══════════════════════════════════════════════════════════════════════════════

  private async generateExcel(
    reportType: ReportType,
    report: ReportResult<any>,
    filters: ReportFilters,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Manchengo Smart ERP';
    workbook.created = new Date();

    const title = this.getReportTitle(reportType);
    const worksheet = workbook.addWorksheet(title);
    const columns = this.getColumns(reportType);
    const period = this.formatPeriod(filters.startDate, filters.endDate);

    // Header rows
    worksheet.mergeCells(1, 1, 1, columns.length);
    const companyRow = worksheet.getRow(1);
    companyRow.getCell(1).value = this.companyInfo.name;
    companyRow.getCell(1).font = { bold: true, size: 14 };
    companyRow.getCell(1).alignment = { horizontal: 'center' };

    worksheet.mergeCells(2, 1, 2, columns.length);
    const fiscalRow = worksheet.getRow(2);
    fiscalRow.getCell(1).value = `NIF: ${this.companyInfo.nif} | RC: ${this.companyInfo.rc}`;
    fiscalRow.getCell(1).font = { size: 9, color: { argb: 'FF666666' } };
    fiscalRow.getCell(1).alignment = { horizontal: 'center' };

    worksheet.mergeCells(3, 1, 3, columns.length);
    const titleRow = worksheet.getRow(3);
    titleRow.getCell(1).value = title;
    titleRow.getCell(1).font = { bold: true, size: 12 };
    titleRow.getCell(1).alignment = { horizontal: 'center' };

    worksheet.mergeCells(4, 1, 4, columns.length);
    const periodRow = worksheet.getRow(4);
    periodRow.getCell(1).value = period;
    periodRow.getCell(1).font = { italic: true, size: 10 };
    periodRow.getCell(1).alignment = { horizontal: 'center' };

    worksheet.getRow(5).height = 10;

    // Column headers
    const headerRow = worksheet.getRow(6);
    headerRow.values = columns.map((c) => c.header);
    headerRow.font = { bold: true, size: 9 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF0F0F0' },
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 20;

    // Data rows
    let rowIndex = 7;
    for (const item of report.data) {
      const row = worksheet.getRow(rowIndex);
      row.values = columns.map((c) => this.formatCellValue(item[c.key], c.type)) as ExcelJS.CellValue[];
      rowIndex++;
    }

    // Summary row
    if (report.summary) {
      rowIndex++;
      const summaryHeaderRow = worksheet.getRow(rowIndex);
      summaryHeaderRow.getCell(1).value = 'RESUME';
      summaryHeaderRow.font = { bold: true, size: 11 };
      rowIndex++;

      for (const [key, value] of Object.entries(report.summary)) {
        if (typeof value === 'number' || typeof value === 'string') {
          const summaryRow = worksheet.getRow(rowIndex);
          summaryRow.getCell(1).value = this.formatSummaryKey(key);
          summaryRow.getCell(1).font = { bold: true, size: 9 };
          summaryRow.getCell(2).value = typeof value === 'number' ? value : String(value);
          rowIndex++;
        }
      }
    }

    // Apply amount formatting
    columns.forEach((col, idx) => {
      if (col.type === 'amount') {
        worksheet.getColumn(idx + 1).numFmt = '#,##0.00 "DA"';
        worksheet.getColumn(idx + 1).alignment = { horizontal: 'right' };
      }
    });

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      let maxLength = 10;
      column.eachCell?.({ includeEmpty: true }, (cell) => {
        const cellValue = cell.value?.toString() || '';
        maxLength = Math.max(maxLength, Math.min(cellValue.length + 2, 50));
      });
      column.width = maxLength;
    });

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PDF GENERATION
  // ═══════════════════════════════════════════════════════════════════════════════

  private async generatePdf(
    reportType: ReportType,
    report: ReportResult<any>,
    filters: ReportFilters,
  ): Promise<Buffer> {
    const title = this.getReportTitle(reportType);
    const columns = this.getColumns(reportType);
    const period = this.formatPeriod(filters.startDate, filters.endDate);

    // Build table body
    const tableHeaders: TableCell[] = columns.map((c) => ({
      text: c.header,
      style: 'tableHeader',
    }));

    const tableRows: TableCell[][] = report.data.map((item: any) =>
      columns.map((c) => ({
        text: String(this.formatCellValue(item[c.key], c.type) ?? '-'),
        style: c.type === 'amount' ? 'tableCellRight' : 'tableCell',
      })),
    );

    // Build summary content
    const summaryContent: Content[] = [];
    if (report.summary) {
      summaryContent.push({
        text: 'Resume',
        style: 'sectionTitle',
        margin: [0, 20, 0, 5] as [number, number, number, number],
      } as Content);

      const summaryEntries = Object.entries(report.summary).filter(
        ([, value]) => typeof value === 'number' || typeof value === 'string',
      );

      if (summaryEntries.length > 0) {
        const summaryBody: TableCell[][] = summaryEntries.map(([key, value]) => [
          { text: this.formatSummaryKey(key), style: 'tableCell', bold: true } as TableCell,
          {
            text: typeof value === 'number' ? this.formatAmount(value) : String(value),
            style: 'tableCellRight',
          } as TableCell,
        ]);

        summaryContent.push({
          table: {
            widths: ['*', 'auto'],
            body: [
              [
                { text: 'Indicateur', style: 'tableHeader' },
                { text: 'Valeur', style: 'tableHeader' },
              ],
              ...summaryBody,
            ],
          },
        } as Content);
      }
    }

    const generatedAt = new Date().toLocaleString('fr-DZ');

    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageOrientation: columns.length > 6 ? 'landscape' : 'portrait',
      pageMargins: [30, 80, 30, 50],
      header: {
        stack: [
          { text: this.companyInfo.name, style: 'companyName', alignment: 'center' },
          { text: `NIF: ${this.companyInfo.nif} | RC: ${this.companyInfo.rc}`, style: 'companyFiscal', alignment: 'center' },
          { text: '', margin: [0, 5] },
          { text: title, style: 'documentTitle', alignment: 'center' },
          { text: period, style: 'period', alignment: 'center' },
        ],
        margin: [30, 15, 30, 0],
      } as Content,
      footer: (currentPage: number, pageCount: number): Content => ({
        columns: [
          { text: `Genere le ${generatedAt}`, style: 'footer', alignment: 'left' },
          { text: `Page ${currentPage} / ${pageCount}`, style: 'footer', alignment: 'right' },
        ],
        margin: [30, 10],
      }),
      content: [
        // Data table
        {
          table: {
            headerRows: 1,
            widths: columns.map((c) => (c.type === 'amount' ? 'auto' : '*')),
            body: [tableHeaders, ...tableRows],
          },
          layout: {
            fillColor: (rowIndex: number) => (rowIndex === 0 ? '#f0f0f0' : null),
          },
        } as Content,
        // Record count
        {
          text: `\nNombre d'enregistrements: ${report.data.length}`,
          style: 'tableCell',
          margin: [0, 10, 0, 0] as [number, number, number, number],
        } as Content,
        // Summary
        ...summaryContent,
      ],
      styles: {
        companyName: { fontSize: 14, bold: true, margin: [0, 0, 0, 3] },
        companyFiscal: { fontSize: 8, color: '#666666', margin: [0, 0, 0, 3] },
        documentTitle: { fontSize: 12, bold: true, margin: [0, 0, 0, 3] },
        period: { fontSize: 10, italics: true, margin: [0, 0, 0, 5] },
        sectionTitle: { fontSize: 11, bold: true },
        tableHeader: { fontSize: 8, bold: true, fillColor: '#f0f0f0' },
        tableCell: { fontSize: 7 },
        tableCellRight: { fontSize: 7, alignment: 'right' },
        totalRow: { fontSize: 8, bold: true, fillColor: '#e0e0e0' },
        footer: { fontSize: 7, color: '#888888' },
      },
      defaultStyle: { font: 'Roboto' },
    };

    return this.generatePdfBuffer(docDefinition);
  }

  private generatePdfBuffer(docDefinition: TDocumentDefinitions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const pdfDoc = this.printer.createPdfKitDocument(docDefinition);
        const chunks: Buffer[] = [];

        pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
        pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
        pdfDoc.on('error', (err: Error) => reject(err));

        pdfDoc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // COLUMN DEFINITIONS PER REPORT TYPE
  // ═══════════════════════════════════════════════════════════════════════════════

  private getColumns(reportType: ReportType): Array<{ key: string; header: string; type: 'text' | 'amount' | 'number' | 'date' | 'percent' }> {
    switch (reportType) {
      case 'stock-valorization':
        return [
          { key: 'type', header: 'Type', type: 'text' },
          { key: 'code', header: 'Code', type: 'text' },
          { key: 'name', header: 'Produit', type: 'text' },
          { key: 'lotNumber', header: 'N\u00b0 Lot', type: 'text' },
          { key: 'quantity', header: 'Quantite', type: 'number' },
          { key: 'unitCost', header: 'Cout Unit.', type: 'amount' },
          { key: 'totalValue', header: 'Valeur Totale', type: 'amount' },
          { key: 'expiryDate', header: 'DLC', type: 'date' },
        ];

      case 'stock-movements':
        return [
          { key: 'date', header: 'Date', type: 'date' },
          { key: 'type', header: 'Type', type: 'text' },
          { key: 'origin', header: 'Origine', type: 'text' },
          { key: 'productCode', header: 'Code', type: 'text' },
          { key: 'productName', header: 'Produit', type: 'text' },
          { key: 'quantity', header: 'Quantite', type: 'number' },
          { key: 'reference', header: 'Reference', type: 'text' },
          { key: 'user', header: 'Utilisateur', type: 'text' },
        ];

      case 'production':
        return [
          { key: 'reference', header: 'Reference', type: 'text' },
          { key: 'product', header: 'Produit', type: 'text' },
          { key: 'recipe', header: 'Recette', type: 'text' },
          { key: 'targetQuantity', header: 'Qty Cible', type: 'number' },
          { key: 'producedQuantity', header: 'Qty Produite', type: 'number' },
          { key: 'yieldPercentage', header: 'Rendement %', type: 'percent' },
          { key: 'status', header: 'Statut', type: 'text' },
          { key: 'duration', header: 'Duree (min)', type: 'number' },
        ];

      case 'purchase-orders':
        return [
          { key: 'reference', header: 'Reference', type: 'text' },
          { key: 'supplier', header: 'Fournisseur', type: 'text' },
          { key: 'status', header: 'Statut', type: 'text' },
          { key: 'totalHT', header: 'Total HT', type: 'amount' },
          { key: 'createdAt', header: 'Cree le', type: 'date' },
          { key: 'leadTime', header: 'Delai (j)', type: 'number' },
          { key: 'itemCount', header: 'Lignes', type: 'number' },
        ];

      case 'suppliers':
        return [
          { key: 'code', header: 'Code', type: 'text' },
          { key: 'name', header: 'Fournisseur', type: 'text' },
          { key: 'totalOrders', header: 'Commandes', type: 'number' },
          { key: 'totalAmount', header: 'Montant Total', type: 'amount' },
          { key: 'receivedOrders', header: 'Recues', type: 'number' },
          { key: 'averageLeadTimeDays', header: 'Delai Moy. (j)', type: 'number' },
        ];

      case 'sales':
        return [
          { key: 'reference', header: 'N\u00b0 Facture', type: 'text' },
          { key: 'date', header: 'Date', type: 'date' },
          { key: 'client', header: 'Client', type: 'text' },
          { key: 'clientType', header: 'Type', type: 'text' },
          { key: 'totalHt', header: 'HT', type: 'amount' },
          { key: 'totalTva', header: 'TVA', type: 'amount' },
          { key: 'totalTtc', header: 'TTC', type: 'amount' },
          { key: 'paymentMethod', header: 'Paiement', type: 'text' },
        ];

      default:
        throw new BadRequestException(`Type de rapport inconnu: ${reportType}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  private getReportTitle(reportType: ReportType): string {
    const titles: Record<ReportType, string> = {
      'stock-valorization': 'Rapport de Valorisation des Stocks',
      'stock-movements': 'Rapport des Mouvements de Stock',
      'production': 'Rapport de Performance Production',
      'purchase-orders': 'Rapport des Bons de Commande',
      'suppliers': 'Rapport Performance Fournisseurs',
      'sales': 'Rapport des Ventes',
    };
    return titles[reportType] || reportType;
  }

  private formatPeriod(startDate: Date, endDate: Date): string {
    const formatDate = (d: Date) =>
      d.toLocaleDateString('fr-DZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `Du ${formatDate(startDate)} au ${formatDate(endDate)}`;
  }

  private formatAmount(value: number): string {
    return value.toLocaleString('fr-DZ', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' DA';
  }

  private formatCellValue(value: unknown, type: string): unknown {
    if (value === null || value === undefined) return '-';

    switch (type) {
      case 'date':
        if (value instanceof Date) {
          return value.toLocaleDateString('fr-DZ', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          });
        }
        if (typeof value === 'string') {
          const date = new Date(value);
          return isNaN(date.getTime()) ? value : date.toLocaleDateString('fr-DZ', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          });
        }
        return String(value);

      case 'amount':
        return typeof value === 'number' ? Math.round(value * 100) / 100 : value;

      case 'percent':
        return typeof value === 'number' ? `${(value).toFixed(1)}%` : '-';

      case 'number':
        return typeof value === 'number' ? value : value;

      default:
        return String(value);
    }
  }

  private formatSummaryKey(key: string): string {
    const labels: Record<string, string> = {
      totalMpValue: 'Valeur MP Totale',
      totalPfValue: 'Valeur PF Totale',
      totalValue: 'Valeur Totale',
      mpLotCount: 'Nombre de Lots MP',
      pfLotCount: 'Nombre de Lots PF',
      totalMovements: 'Total Mouvements',
      totalIn: 'Total Entrees',
      totalOut: 'Total Sorties',
      totalInQuantity: 'Quantite Entree',
      totalOutQuantity: 'Quantite Sortie',
      totalOrders: 'Total Commandes',
      completed: 'Terminees',
      inProgress: 'En Cours',
      pending: 'En Attente',
      cancelled: 'Annulees',
      averageYield: 'Rendement Moyen',
      totalProduced: 'Total Produit',
      totalAmount: 'Montant Total',
      draft: 'Brouillon',
      sent: 'Envoyees',
      confirmed: 'Confirmees',
      received: 'Recues',
      averageLeadTimeDays: 'Delai Moyen (j)',
      totalSuppliers: 'Total Fournisseurs',
      totalPurchases: 'Total Achats',
      totalInvoices: 'Total Factures',
      totalHt: 'Total HT',
      totalTva: 'Total TVA',
      totalTtc: 'Total TTC',
    };
    return labels[key] || key;
  }
}
