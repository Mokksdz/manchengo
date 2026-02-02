import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { ExcelGeneratorService } from './excel-generator.service';
import { ExportFormat } from '../dto/export.dto';
import { TDocumentDefinitions } from 'pdfmake/interfaces';

interface PfStockEntry {
  code: string;
  product: string;
  unit: string;
  initialStock: number;
  entries: number;  // production
  exits: number;    // sales
  finalStock: number;
  stockValue: number;
}

/**
 * PF Stocks Export Service
 * 
 * Generates detailed stock reports for finished products (Produits Finis)
 * 
 * Columns:
 * - Code PF
 * - Produit
 * - Unité
 * - Stock initial
 * - Entrées (production)
 * - Sorties (ventes)
 * - Stock final
 * - Valeur stock
 */
@Injectable()
export class PfStocksService {
  constructor(
    private prisma: PrismaService,
    private pdfGenerator: PdfGeneratorService,
    private excelGenerator: ExcelGeneratorService,
  ) {}

  /**
   * Get PF stock entries for the period
   */
  async getStockEntries(startDate: Date, endDate: Date): Promise<PfStockEntry[]> {
    const products = await this.prisma.productPf.findMany({
      include: {
        lots: true,
      },
      orderBy: { code: 'asc' },
    });

    const entries: PfStockEntry[] = [];

    for (const product of products) {
      const lotIds = product.lots.map((l) => l.id);

      // Get movements before period for initial stock
      const priorMovements = await this.prisma.stockMovement.findMany({
        where: {
          lotPfId: { in: lotIds },
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
          lotPfId: { in: lotIds },
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

      // Use product price as stock value basis
      const unitValue = product.priceHt || 0;

      entries.push({
        code: product.code,
        product: product.name,
        unit: product.unit,
        initialStock,
        entries: periodEntries,
        exits: periodExits,
        finalStock,
        stockValue: finalStock * unitValue,
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
    entries: PfStockEntry[],
    startDate: Date,
    endDate: Date,
  ): Promise<Buffer> {
    const period = this.pdfGenerator.formatPeriod(startDate, endDate);
    const totalValue = entries.reduce((sum, e) => sum + e.stockValue, 0);

    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [40, 60, 40, 60],
      header: this.pdfGenerator.createHeader('ÉTAT DES STOCKS - PRODUITS FINIS', period),
      footer: this.pdfGenerator.createFooter(),
      content: [
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
            body: [
              [
                { text: 'Code', style: 'tableHeader' },
                { text: 'Produit', style: 'tableHeader' },
                { text: 'Unité', style: 'tableHeader' },
                { text: 'Stock Initial', style: 'tableHeader' },
                { text: 'Entrées (Prod.)', style: 'tableHeader' },
                { text: 'Sorties (Ventes)', style: 'tableHeader' },
                { text: 'Stock Final', style: 'tableHeader' },
                { text: 'Valeur Stock (DA)', style: 'tableHeader' },
              ],
              ...entries.map((e) => [
                this.pdfGenerator.textCell(e.code),
                this.pdfGenerator.textCell(e.product),
                this.pdfGenerator.textCell(e.unit),
                { text: e.initialStock.toFixed(0), style: 'tableCellRight' },
                { text: e.entries.toFixed(0), style: 'tableCellRight' },
                { text: e.exits.toFixed(0), style: 'tableCellRight' },
                { text: e.finalStock.toFixed(0), style: 'tableCellRight' },
                this.pdfGenerator.amountCell(e.stockValue),
              ]),
              // Total row
              [
                { text: 'TOTAL VALEUR STOCK', style: 'totalRow', colSpan: 7 },
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
    entries: PfStockEntry[],
    startDate: Date,
    endDate: Date,
  ): Promise<Buffer> {
    const workbook = this.excelGenerator.createWorkbook();
    const period = this.excelGenerator.formatPeriod(startDate, endDate);
    const sheet = workbook.addWorksheet('État Stocks PF');

    this.excelGenerator.addHeader(sheet, 'ÉTAT DES STOCKS - PRODUITS FINIS', period, 8);

    const headerRow = sheet.getRow(6);
    headerRow.values = ['Code', 'Produit', 'Unité', 'Stock Initial', 'Entrées (Prod.)', 'Sorties (Ventes)', 'Stock Final', 'Valeur Stock (DA)'];
    this.excelGenerator.styleHeaderRow(headerRow);

    let rowIndex = 7;
    for (const entry of entries) {
      sheet.getRow(rowIndex).values = [
        entry.code,
        entry.product,
        entry.unit,
        entry.initialStock,
        entry.entries,
        entry.exits,
        entry.finalStock,
        entry.stockValue,
      ];
      rowIndex++;
    }

    // Total row
    const totalValue = entries.reduce((sum, e) => sum + e.stockValue, 0);
    const totalRow = sheet.getRow(rowIndex);
    totalRow.values = ['TOTAL VALEUR STOCK', '', '', '', '', '', '', totalValue];
    this.excelGenerator.styleTotalRow(totalRow);

    this.excelGenerator.applyAmountFormat(sheet, 8);
    this.excelGenerator.autoFitColumns(sheet);

    return this.excelGenerator.generateBuffer(workbook);
  }
}
