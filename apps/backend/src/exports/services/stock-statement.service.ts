import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { ExcelGeneratorService } from './excel-generator.service';
import { StockStatementEntry, StockStatementSummary, ExportFormat } from '../dto/export.dto';
import { TDocumentDefinitions } from 'pdfmake/interfaces';

/**
 * Stock Statement Service (État des Stocks)
 * 
 * Generates stock movement reports for fiscal compliance.
 * 
 * Reports include:
 * - Initial stock at period start
 * - Entries (receptions for MP, production for PF)
 * - Exits (consumption for MP, sales for PF)
 * - Final stock at period end
 * 
 * Legal requirements:
 * - Separate MP (Matières Premières) and PF (Produits Finis)
 * - Stock valuation for accounting
 * - Movement traceability
 */
@Injectable()
export class StockStatementService {
  constructor(
    private prisma: PrismaService,
    private pdfGenerator: PdfGeneratorService,
    private excelGenerator: ExcelGeneratorService,
  ) {}

  /**
   * Calculate stock statement for MP products
   * Batched queries to avoid N+1 performance issue
   */
  private async getMpStatement(
    startDate: Date,
    endDate: Date,
  ): Promise<StockStatementEntry[]> {
    const products = await this.prisma.productMp.findMany({
      include: {
        lots: true,
      },
    });

    // Batch: collect all lot IDs across all products
    const allLotIds = products.flatMap(p => p.lots?.map(l => l.id) ?? []);

    if (allLotIds.length === 0) {
      return products.map(product => ({
        productCode: product.code,
        productName: product.name,
        unit: product.unit,
        initialStock: 0,
        entries: 0,
        exits: 0,
        finalStock: 0,
        averageValue: 0,
      }));
    }

    // Batch: 2 queries instead of 2*N
    const [allMovements, allPriorMovements] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where: {
          lotMpId: { in: allLotIds },
          createdAt: { gte: startDate, lte: endDate },
          isDeleted: false,
        },
        select: { lotMpId: true, movementType: true, quantity: true, unitCost: true },
      }),
      this.prisma.stockMovement.findMany({
        where: {
          lotMpId: { in: allLotIds },
          createdAt: { lt: startDate },
          isDeleted: false,
        },
        select: { lotMpId: true, movementType: true, quantity: true, unitCost: true },
      }),
    ]);

    // Group movements by lotMpId for efficient lookup
    const movementsByLot = new Map<number, typeof allMovements>();
    for (const m of allMovements) {
      if (!m.lotMpId) continue;
      const existing = movementsByLot.get(m.lotMpId) || [];
      existing.push(m);
      movementsByLot.set(m.lotMpId, existing);
    }

    const priorByLot = new Map<number, typeof allPriorMovements>();
    for (const m of allPriorMovements) {
      if (!m.lotMpId) continue;
      const existing = priorByLot.get(m.lotMpId) || [];
      existing.push(m);
      priorByLot.set(m.lotMpId, existing);
    }

    const statements: StockStatementEntry[] = [];

    for (const product of products) {
      const lotIds = product.lots.map(l => l.id);

      // Calculate entries and exits from pre-fetched data
      let entries = 0;
      let exits = 0;
      const productMovements: typeof allMovements = [];
      for (const lotId of lotIds) {
        for (const mov of movementsByLot.get(lotId) || []) {
          productMovements.push(mov);
          if (mov.movementType === 'IN') {
            entries += mov.quantity;
          } else {
            exits += Math.abs(mov.quantity);
          }
        }
      }

      // Calculate initial stock from pre-fetched prior movements
      let initialStock = 0;
      const productPriorMovements: typeof allPriorMovements = [];
      for (const lotId of lotIds) {
        for (const mov of priorByLot.get(lotId) || []) {
          productPriorMovements.push(mov);
          if (mov.movementType === 'IN') {
            initialStock += mov.quantity;
          } else {
            initialStock -= Math.abs(mov.quantity);
          }
        }
      }

      const finalStock = initialStock + entries - exits;

      // Calculate weighted average cost (CUMP) from all IN movements
      const allInMovements = [...productPriorMovements, ...productMovements].filter(m => m.movementType === 'IN');
      const totalCost = allInMovements.reduce((sum, m) => sum + (Number(m.quantity) * (m.unitCost || 0)), 0);
      const totalQtyIn = allInMovements.reduce((sum, m) => sum + Number(m.quantity), 0);
      const averageValue = totalQtyIn > 0 ? Math.round(totalCost / totalQtyIn) : 0;

      statements.push({
        productCode: product.code,
        productName: product.name,
        unit: product.unit,
        initialStock,
        entries,
        exits,
        finalStock,
        averageValue,
      });
    }

    return statements;
  }

  /**
   * Calculate stock statement for PF products
   * Batched queries to avoid N+1 performance issue
   */
  private async getPfStatement(
    startDate: Date,
    endDate: Date,
  ): Promise<StockStatementEntry[]> {
    const products = await this.prisma.productPf.findMany({
      include: {
        lots: true,
      },
    });

    // Batch: collect all lot IDs across all products
    const allLotIds = products.flatMap(p => p.lots?.map(l => l.id) ?? []);

    if (allLotIds.length === 0) {
      return products.map(product => ({
        productCode: product.code,
        productName: product.name,
        unit: product.unit,
        initialStock: 0,
        entries: 0,
        exits: 0,
        finalStock: 0,
        averageValue: product.priceHt,
      }));
    }

    // Batch: 2 queries instead of 2*N
    const [allMovements, allPriorMovements] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where: {
          lotPfId: { in: allLotIds },
          createdAt: { gte: startDate, lte: endDate },
          isDeleted: false,
        },
        select: { lotPfId: true, movementType: true, quantity: true },
      }),
      this.prisma.stockMovement.findMany({
        where: {
          lotPfId: { in: allLotIds },
          createdAt: { lt: startDate },
          isDeleted: false,
        },
        select: { lotPfId: true, movementType: true, quantity: true },
      }),
    ]);

    // Group movements by lotPfId for efficient lookup
    const movementsByLot = new Map<number, typeof allMovements>();
    for (const m of allMovements) {
      if (!m.lotPfId) continue;
      const existing = movementsByLot.get(m.lotPfId) || [];
      existing.push(m);
      movementsByLot.set(m.lotPfId, existing);
    }

    const priorByLot = new Map<number, typeof allPriorMovements>();
    for (const m of allPriorMovements) {
      if (!m.lotPfId) continue;
      const existing = priorByLot.get(m.lotPfId) || [];
      existing.push(m);
      priorByLot.set(m.lotPfId, existing);
    }

    const statements: StockStatementEntry[] = [];

    for (const product of products) {
      const lotIds = product.lots.map(l => l.id);

      // Calculate entries and exits from pre-fetched data
      let entries = 0;
      let exits = 0;
      for (const lotId of lotIds) {
        for (const mov of movementsByLot.get(lotId) || []) {
          if (mov.movementType === 'IN') {
            entries += mov.quantity;
          } else {
            exits += Math.abs(mov.quantity);
          }
        }
      }

      // Calculate initial stock from pre-fetched prior movements
      let initialStock = 0;
      for (const lotId of lotIds) {
        for (const mov of priorByLot.get(lotId) || []) {
          if (mov.movementType === 'IN') {
            initialStock += mov.quantity;
          } else {
            initialStock -= Math.abs(mov.quantity);
          }
        }
      }

      const finalStock = initialStock + entries - exits;

      statements.push({
        productCode: product.code,
        productName: product.name,
        unit: product.unit,
        initialStock,
        entries,
        exits,
        finalStock,
        averageValue: product.priceHt, // Use selling price as proxy
      });
    }

    return statements;
  }

  /**
   * Get full stock statement summary
   */
  async getStatement(startDate: Date, endDate: Date): Promise<StockStatementSummary> {
    const mp = await this.getMpStatement(startDate, endDate);
    const pf = await this.getPfStatement(startDate, endDate);

    return {
      mp,
      pf,
      totalMpValue: mp.reduce((sum, e) => sum + e.finalStock * e.averageValue, 0),
      totalPfValue: pf.reduce((sum, e) => sum + e.finalStock * e.averageValue, 0),
    };
  }

  /**
   * Generate export in requested format
   */
  async generate(
    startDate: Date,
    endDate: Date,
    format: ExportFormat,
  ): Promise<Buffer> {
    const statement = await this.getStatement(startDate, endDate);

    if (format === ExportFormat.EXCEL) {
      return this.generateExcel(statement, startDate, endDate);
    }
    return this.generatePdf(statement, startDate, endDate);
  }

  /**
   * Generate PDF version of stock statement
   */
  private async generatePdf(
    statement: StockStatementSummary,
    startDate: Date,
    endDate: Date,
  ): Promise<Buffer> {
    const period = this.pdfGenerator.formatPeriod(startDate, endDate);

    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [40, 60, 40, 60],
      header: this.pdfGenerator.createHeader('ÉTAT DES STOCKS', period),
      footer: this.pdfGenerator.createFooter(),
      content: [
        // MP Section
        { text: 'MATIÈRES PREMIÈRES (MP)', style: 'sectionTitle' },
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto'],
            body: [
              [
                { text: 'Code', style: 'tableHeader' },
                { text: 'Désignation', style: 'tableHeader' },
                { text: 'Unité', style: 'tableHeader' },
                { text: 'Stock Initial', style: 'tableHeader' },
                { text: 'Entrées', style: 'tableHeader' },
                { text: 'Sorties', style: 'tableHeader' },
                { text: 'Stock Final', style: 'tableHeader' },
              ],
              ...statement.mp.map((e) => [
                this.pdfGenerator.textCell(e.productCode),
                this.pdfGenerator.textCell(e.productName),
                this.pdfGenerator.textCell(e.unit),
                { text: e.initialStock.toString(), style: 'tableCellRight' },
                { text: e.entries.toString(), style: 'tableCellRight' },
                { text: e.exits.toString(), style: 'tableCellRight' },
                { text: e.finalStock.toString(), style: 'tableCellRight' },
              ]),
            ],
          },
        },
        // PF Section
        { text: 'PRODUITS FINIS (PF)', style: 'sectionTitle', margin: [0, 20, 0, 5] },
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
                { text: 'Valeur Stock', style: 'tableHeader' },
              ],
              ...statement.pf.map((e) => [
                this.pdfGenerator.textCell(e.productCode),
                this.pdfGenerator.textCell(e.productName),
                this.pdfGenerator.textCell(e.unit),
                { text: e.initialStock.toString(), style: 'tableCellRight' },
                { text: e.entries.toString(), style: 'tableCellRight' },
                { text: e.exits.toString(), style: 'tableCellRight' },
                { text: e.finalStock.toString(), style: 'tableCellRight' },
                this.pdfGenerator.amountCell(e.finalStock * e.averageValue),
              ]),
              // PF Total
              [
                { text: 'TOTAL VALEUR PF', style: 'totalRow', colSpan: 7 },
                {}, {}, {}, {}, {}, {},
                { text: this.pdfGenerator.formatAmount(statement.totalPfValue), style: 'totalRow', alignment: 'right' },
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
   * Generate Excel version of stock statement
   */
  private async generateExcel(
    statement: StockStatementSummary,
    startDate: Date,
    endDate: Date,
  ): Promise<Buffer> {
    const workbook = this.excelGenerator.createWorkbook();
    const period = this.excelGenerator.formatPeriod(startDate, endDate);

    // MP Sheet
    const mpSheet = workbook.addWorksheet('Matières Premières');
    this.excelGenerator.addHeader(mpSheet, 'ÉTAT DES STOCKS - MATIÈRES PREMIÈRES', period, 7);

    const mpHeaderRow = mpSheet.getRow(6);
    mpHeaderRow.values = ['Code', 'Désignation', 'Unité', 'Stock Initial', 'Entrées', 'Sorties', 'Stock Final'];
    this.excelGenerator.styleHeaderRow(mpHeaderRow);

    let rowIndex = 7;
    for (const entry of statement.mp) {
      mpSheet.getRow(rowIndex).values = [
        entry.productCode,
        entry.productName,
        entry.unit,
        entry.initialStock,
        entry.entries,
        entry.exits,
        entry.finalStock,
      ];
      rowIndex++;
    }
    this.excelGenerator.autoFitColumns(mpSheet);

    // PF Sheet
    const pfSheet = workbook.addWorksheet('Produits Finis');
    this.excelGenerator.addHeader(pfSheet, 'ÉTAT DES STOCKS - PRODUITS FINIS', period, 8);

    const pfHeaderRow = pfSheet.getRow(6);
    pfHeaderRow.values = ['Code', 'Désignation', 'Unité', 'Stock Initial', 'Entrées', 'Sorties', 'Stock Final', 'Valeur Stock'];
    this.excelGenerator.styleHeaderRow(pfHeaderRow);

    rowIndex = 7;
    for (const entry of statement.pf) {
      pfSheet.getRow(rowIndex).values = [
        entry.productCode,
        entry.productName,
        entry.unit,
        entry.initialStock,
        entry.entries,
        entry.exits,
        entry.finalStock,
        this.excelGenerator.formatAmount(entry.finalStock * entry.averageValue),
      ];
      rowIndex++;
    }

    // Total row
    const totalRow = pfSheet.getRow(rowIndex);
    totalRow.values = ['TOTAL', '', '', '', '', '', '', this.excelGenerator.formatAmount(statement.totalPfValue)];
    this.excelGenerator.styleTotalRow(totalRow);

    this.excelGenerator.applyAmountFormat(pfSheet, 8);
    this.excelGenerator.autoFitColumns(pfSheet);

    return this.excelGenerator.generateBuffer(workbook);
  }
}
