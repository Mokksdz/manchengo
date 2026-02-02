import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { ExcelGeneratorService } from './excel-generator.service';
import { ExportFormat } from '../dto/export.dto';
import { TDocumentDefinitions } from 'pdfmake/interfaces';

interface ReceptionEntry {
  date: string;
  supplier: string;
  reference: string;
  blFournisseur: string;
  productCode: string;
  productName: string;
  quantity: number;
  unit: string;
  unitCost: number;
  tvaRate: number;
  totalHT: number;
  tvaAmount: number;
  totalTTC: number;
}

/**
 * MP Receptions Journal Service
 * 
 * Generates reception journal for raw materials with TVA
 * 
 * Columns:
 * - Date
 * - Fournisseur
 * - Référence réception
 * - BL fournisseur
 * - Produit MP
 * - Quantité
 * - P.U HT
 * - TVA %
 * - Total HT
 * - Montant TVA
 * - Total TTC
 * 
 * Used for: fiscal control, accounting, supplier audit, G50 declaration
 */
@Injectable()
export class MpReceptionsService {
  constructor(
    private prisma: PrismaService,
    private pdfGenerator: PdfGeneratorService,
    private excelGenerator: ExcelGeneratorService,
  ) {}

  /**
   * Get reception entries for the period
   */
  async getReceptionEntries(startDate: Date, endDate: Date): Promise<ReceptionEntry[]> {
    const receptions = await this.prisma.receptionMp.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
      },
      include: {
        supplier: true,
        lines: {
          include: {
            productMp: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    const entries: ReceptionEntry[] = [];

    for (const reception of receptions) {
      for (const line of reception.lines) {
        const unitCost = line.unitCost || 0;
        const tvaRate = line.tvaRate || 19;
        const totalHT = line.totalHT || (line.quantity * unitCost);
        const tvaAmount = line.tvaAmount || Math.round(totalHT * tvaRate / 100);
        const totalTTC = line.totalTTC || (totalHT + tvaAmount);
        
        entries.push({
          date: new Date(reception.date).toLocaleDateString('fr-FR'),
          supplier: reception.supplier?.name || 'N/A',
          reference: reception.reference,
          blFournisseur: reception.blNumber || '-',
          productCode: line.productMp.code,
          productName: line.productMp.name,
          quantity: line.quantity,
          unit: line.productMp.unit,
          unitCost,
          tvaRate,
          totalHT,
          tvaAmount,
          totalTTC,
        });
      }
    }

    return entries;
  }

  /**
   * Generate export in requested format
   */
  async generate(startDate: Date, endDate: Date, format: ExportFormat): Promise<Buffer> {
    const entries = await this.getReceptionEntries(startDate, endDate);

    if (format === ExportFormat.EXCEL) {
      return this.generateExcel(entries, startDate, endDate);
    }
    return this.generatePdf(entries, startDate, endDate);
  }

  /**
   * Generate PDF version with TVA columns
   */
  private async generatePdf(
    entries: ReceptionEntry[],
    startDate: Date,
    endDate: Date,
  ): Promise<Buffer> {
    const period = this.pdfGenerator.formatPeriod(startDate, endDate);
    const totalHT = entries.reduce((sum, e) => sum + e.totalHT, 0);
    const totalTVA = entries.reduce((sum, e) => sum + e.tvaAmount, 0);
    const totalTTC = entries.reduce((sum, e) => sum + e.totalTTC, 0);
    const totalQty = entries.reduce((sum, e) => sum + e.quantity, 0);

    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [20, 60, 20, 60],
      header: this.pdfGenerator.createHeader('JOURNAL DES RÉCEPTIONS MP - TVA ACHATS', period),
      footer: this.pdfGenerator.createFooter(),
      content: [
        {
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', 'auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
            body: [
              [
                { text: 'Date', style: 'tableHeader' },
                { text: 'Fournisseur', style: 'tableHeader' },
                { text: 'Réf.', style: 'tableHeader' },
                { text: 'Produit', style: 'tableHeader' },
                { text: 'Qté', style: 'tableHeader' },
                { text: 'P.U HT', style: 'tableHeader' },
                { text: 'TVA %', style: 'tableHeader' },
                { text: 'Total HT', style: 'tableHeader' },
                { text: 'TVA', style: 'tableHeader' },
                { text: 'Total TTC', style: 'tableHeader' },
              ],
              ...entries.map((e) => [
                this.pdfGenerator.textCell(e.date),
                this.pdfGenerator.textCell(e.supplier),
                this.pdfGenerator.textCell(e.reference),
                this.pdfGenerator.textCell(`${e.productCode} - ${e.productName}`),
                { text: e.quantity.toFixed(0), style: 'tableCellRight' },
                this.pdfGenerator.amountCell(e.unitCost),
                { text: `${e.tvaRate}%`, style: 'tableCellRight' },
                this.pdfGenerator.amountCell(e.totalHT),
                this.pdfGenerator.amountCell(e.tvaAmount),
                this.pdfGenerator.amountCell(e.totalTTC),
              ]),
              // Total row
              [
                { text: 'TOTAUX', style: 'totalRow', colSpan: 4 },
                {}, {}, {},
                { text: totalQty.toFixed(0), style: 'totalRow', alignment: 'right' },
                { text: '', style: 'totalRow' },
                { text: '', style: 'totalRow' },
                { text: this.pdfGenerator.formatAmount(totalHT), style: 'totalRow', alignment: 'right' },
                { text: this.pdfGenerator.formatAmount(totalTVA), style: 'totalRow', alignment: 'right' },
                { text: this.pdfGenerator.formatAmount(totalTTC), style: 'totalRow', alignment: 'right' },
              ],
            ],
          },
        },
        {
          text: `Nombre de lignes: ${entries.length} | Base HT: ${this.pdfGenerator.formatAmount(totalHT)} DA | TVA déductible: ${this.pdfGenerator.formatAmount(totalTVA)} DA`,
          style: 'summary',
          margin: [0, 10, 0, 0],
        },
      ],
      styles: this.pdfGenerator.getDefaultStyles(),
      defaultStyle: { font: 'Roboto', fontSize: 7 },
    };

    return this.pdfGenerator.generatePdf(docDefinition);
  }

  /**
   * Generate Excel version with TVA columns
   */
  private async generateExcel(
    entries: ReceptionEntry[],
    startDate: Date,
    endDate: Date,
  ): Promise<Buffer> {
    const workbook = this.excelGenerator.createWorkbook();
    const period = this.excelGenerator.formatPeriod(startDate, endDate);
    const sheet = workbook.addWorksheet('Journal Réceptions MP - TVA');

    this.excelGenerator.addHeader(sheet, 'JOURNAL DES RÉCEPTIONS MP - TVA ACHATS', period, 12);

    const headerRow = sheet.getRow(6);
    headerRow.values = ['Date', 'Fournisseur', 'Référence', 'BL', 'Code', 'Produit', 'Qté', 'Unité', 'P.U HT', 'TVA %', 'Total HT', 'TVA', 'Total TTC'];
    this.excelGenerator.styleHeaderRow(headerRow);

    let rowIndex = 7;
    for (const entry of entries) {
      sheet.getRow(rowIndex).values = [
        entry.date,
        entry.supplier,
        entry.reference,
        entry.blFournisseur,
        entry.productCode,
        entry.productName,
        entry.quantity,
        entry.unit,
        entry.unitCost / 100, // Convert from centimes to DA
        entry.tvaRate,
        entry.totalHT / 100,
        entry.tvaAmount / 100,
        entry.totalTTC / 100,
      ];
      rowIndex++;
    }

    // Total row
    const totalHT = entries.reduce((sum, e) => sum + e.totalHT, 0);
    const totalTVA = entries.reduce((sum, e) => sum + e.tvaAmount, 0);
    const totalTTC = entries.reduce((sum, e) => sum + e.totalTTC, 0);
    const totalQty = entries.reduce((sum, e) => sum + e.quantity, 0);
    const totalRow = sheet.getRow(rowIndex);
    totalRow.values = ['TOTAUX', '', '', '', '', '', totalQty, '', '', '', totalHT / 100, totalTVA / 100, totalTTC / 100];
    this.excelGenerator.styleTotalRow(totalRow);

    this.excelGenerator.applyAmountFormat(sheet, 9);
    this.excelGenerator.applyAmountFormat(sheet, 11);
    this.excelGenerator.applyAmountFormat(sheet, 12);
    this.excelGenerator.applyAmountFormat(sheet, 13);
    this.excelGenerator.applyAmountFormat(sheet, 10);
    this.excelGenerator.autoFitColumns(sheet);

    return this.excelGenerator.generateBuffer(workbook);
  }
}
