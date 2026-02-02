import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { ExcelGeneratorService } from './excel-generator.service';
import { ExportFormat } from '../dto/export.dto';
import { TDocumentDefinitions } from 'pdfmake/interfaces';

interface MpStockEntry {
  code: string;
  designation: string;
  unit: string;
  initialStock: number;
  entries: number;
  exits: number;
  finalStock: number;
  value: number;
}

/**
 * MP Stocks Export Service
 * 
 * Generates detailed stock reports for raw materials (Matières Premières)
 * 
 * Columns:
 * - Code MP
 * - Désignation
 * - Unité
 * - Stock initial (période)
 * - Entrées (réceptions)
 * - Sorties (production)
 * - Stock final
 * - Valeur (optionnel)
 */
@Injectable()
export class MpStocksService {
  constructor(
    private prisma: PrismaService,
    private pdfGenerator: PdfGeneratorService,
    private excelGenerator: ExcelGeneratorService,
  ) {}

  /**
   * Get MP stock entries for the period
   */
  async getStockEntries(startDate: Date, endDate: Date): Promise<MpStockEntry[]> {
    const products = await this.prisma.productMp.findMany({
      include: {
        lots: true,
      },
      orderBy: { code: 'asc' },
    });

    const entries: MpStockEntry[] = [];

    for (const product of products) {
      const lotIds = product.lots.map((l) => l.id);

      // Get movements before period for initial stock
      const priorMovements = await this.prisma.stockMovement.findMany({
        where: {
          lotMpId: { in: lotIds },
          createdAt: { lt: startDate },
        },
      });

      let initialStock = 0;
      for (const mov of priorMovements) {
        if (mov.movementType === 'IN') {
          initialStock += mov.quantity;
        } else {
          initialStock -= Math.abs(mov.quantity);
        }
      }

      // Get movements during period
      const periodMovements = await this.prisma.stockMovement.findMany({
        where: {
          lotMpId: { in: lotIds },
          createdAt: { gte: startDate, lte: endDate },
        },
      });

      let periodEntries = 0;
      let periodExits = 0;

      for (const mov of periodMovements) {
        if (mov.movementType === 'IN') {
          periodEntries += mov.quantity;
        } else {
          periodExits += Math.abs(mov.quantity);
        }
      }

      const finalStock = initialStock + periodEntries - periodExits;

      // Calculate average unit cost from lots
      const activeLots = product.lots.filter(l => l.quantityRemaining > 0);
      const avgUnitCost = activeLots.length > 0
        ? activeLots.reduce((sum, l) => sum + (l.unitCost || 0), 0) / activeLots.length
        : 0;

      entries.push({
        code: product.code,
        designation: product.name,
        unit: product.unit,
        initialStock,
        entries: periodEntries,
        exits: periodExits,
        finalStock,
        value: finalStock * avgUnitCost,
      });
    }

    return entries;
  }

  /**
   * Generate export in requested format
   */
  async generate(startDate: Date, endDate: Date, format: ExportFormat): Promise<Buffer> {
    const entries = await this.getStockEntries(startDate, endDate);

    if (format === ExportFormat.EXCEL) {
      return this.generateExcel(entries, startDate, endDate);
    }
    return this.generatePdf(entries, startDate, endDate);
  }

  /**
   * Generate PDF version
   */
  private async generatePdf(
    entries: MpStockEntry[],
    startDate: Date,
    endDate: Date,
  ): Promise<Buffer> {
    const period = this.pdfGenerator.formatPeriod(startDate, endDate);
    const totalValue = entries.reduce((sum, e) => sum + e.value, 0);

    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [40, 60, 40, 60],
      header: this.pdfGenerator.createHeader('ÉTAT DES STOCKS - MATIÈRES PREMIÈRES', period),
      footer: this.pdfGenerator.createFooter(),
      content: [
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
            body: [
              [
                { text: 'Code', style: 'tableHeader' },
                { text: 'Désignation', style: 'tableHeader' },
                { text: 'Unité', style: 'tableHeader' },
                { text: 'Stock Initial', style: 'tableHeader' },
                { text: 'Entrées', style: 'tableHeader' },
                { text: 'Sorties', style: 'tableHeader' },
                { text: 'Stock Final', style: 'tableHeader' },
                { text: 'Valeur (DA)', style: 'tableHeader' },
              ],
              ...entries.map((e) => [
                this.pdfGenerator.textCell(e.code),
                this.pdfGenerator.textCell(e.designation),
                this.pdfGenerator.textCell(e.unit),
                { text: e.initialStock.toFixed(2), style: 'tableCellRight' },
                { text: e.entries.toFixed(2), style: 'tableCellRight' },
                { text: e.exits.toFixed(2), style: 'tableCellRight' },
                { text: e.finalStock.toFixed(2), style: 'tableCellRight' },
                this.pdfGenerator.amountCell(e.value),
              ]),
              // Total row
              [
                { text: 'TOTAL', style: 'totalRow', colSpan: 7 },
                {}, {}, {}, {}, {}, {},
                { text: this.pdfGenerator.formatAmount(totalValue), style: 'totalRow', alignment: 'right' },
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
   * Generate Excel version
   */
  private async generateExcel(
    entries: MpStockEntry[],
    startDate: Date,
    endDate: Date,
  ): Promise<Buffer> {
    const workbook = this.excelGenerator.createWorkbook();
    const period = this.excelGenerator.formatPeriod(startDate, endDate);
    const sheet = workbook.addWorksheet('État Stocks MP');

    this.excelGenerator.addHeader(sheet, 'ÉTAT DES STOCKS - MATIÈRES PREMIÈRES', period, 8);

    const headerRow = sheet.getRow(6);
    headerRow.values = ['Code', 'Désignation', 'Unité', 'Stock Initial', 'Entrées', 'Sorties', 'Stock Final', 'Valeur (DA)'];
    this.excelGenerator.styleHeaderRow(headerRow);

    let rowIndex = 7;
    for (const entry of entries) {
      sheet.getRow(rowIndex).values = [
        entry.code,
        entry.designation,
        entry.unit,
        entry.initialStock,
        entry.entries,
        entry.exits,
        entry.finalStock,
        entry.value,
      ];
      rowIndex++;
    }

    // Total row
    const totalValue = entries.reduce((sum, e) => sum + e.value, 0);
    const totalRow = sheet.getRow(rowIndex);
    totalRow.values = ['TOTAL', '', '', '', '', '', '', totalValue];
    this.excelGenerator.styleTotalRow(totalRow);

    this.excelGenerator.applyAmountFormat(sheet, 8);
    this.excelGenerator.autoFitColumns(sheet);

    return this.excelGenerator.generateBuffer(workbook);
  }
}
