import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { ExcelGeneratorService } from './excel-generator.service';
import { ExportFormat } from '../dto/export.dto';
import { TDocumentDefinitions } from 'pdfmake/interfaces';

interface ProductionEntry {
  dateProduction: string;
  referenceOF: string;
  productCode: string;
  productName: string;
  quantityProduced: number;
  unit: string;
  lotsConsumes: string;
  rendement: string;
  responsable: string;
}

/**
 * PF Production Journal Service
 * 
 * Generates production journal for finished products
 * 
 * Columns:
 * - Date production
 * - Référence OF
 * - Produit PF
 * - Quantité produite
 * - Lots MP consommés
 * - Rendement
 * - Responsable
 * 
 * Used for: industrial documentation, quality control
 */
@Injectable()
export class PfProductionService {
  constructor(
    private prisma: PrismaService,
    private pdfGenerator: PdfGeneratorService,
    private excelGenerator: ExcelGeneratorService,
  ) {}

  /**
   * Get production entries for the period
   */
  async getProductionEntries(startDate: Date, endDate: Date): Promise<ProductionEntry[]> {
    // Use raw query approach for complex joins
    const productions = await this.prisma.$queryRaw<any[]>`
      SELECT 
        po.id,
        po.reference,
        po.completed_at as "completedAt",
        po.quantity_produced as "quantityProduced",
        po.target_quantity as "targetQuantity",
        po.yield_percentage as "yieldPercentage",
        pf.code as "productCode",
        pf.name as "productName",
        pf.unit as "productUnit",
        u.first_name as "userFirstName",
        u.last_name as "userLastName"
      FROM production_orders po
      JOIN products_pf pf ON po.product_pf_id = pf.id
      LEFT JOIN users u ON po.user_id = u.id
      WHERE po.status = 'COMPLETED'
        AND po.completed_at >= ${startDate}
        AND po.completed_at <= ${endDate}
      ORDER BY po.completed_at ASC
    `;

    const entries: ProductionEntry[] = [];

    for (const prod of productions) {
      // Get consumptions for this production
      const consumptions = await this.prisma.$queryRaw<any[]>`
        SELECT 
          pc.quantity_consumed as "quantityConsumed",
          mp.code as "mpCode",
          mp.unit as "mpUnit"
        FROM production_consumptions pc
        JOIN products_mp mp ON pc.product_mp_id = mp.id
        WHERE pc.production_order_id = ${prod.id}
        LIMIT 3
      `;

      const lotsConsumes = consumptions
        .map((c) => `${c.mpCode}: ${c.quantityConsumed}${c.mpUnit}`)
        .join(', ');

      // Calculate rendement
      const expectedQty = prod.targetQuantity || 0;
      const actualQty = prod.quantityProduced || 0;
      const rendement = prod.yieldPercentage 
        ? `${prod.yieldPercentage.toFixed(1)}%`
        : expectedQty > 0 
          ? `${((actualQty / expectedQty) * 100).toFixed(1)}%`
          : '-';

      entries.push({
        dateProduction: prod.completedAt 
          ? new Date(prod.completedAt).toLocaleDateString('fr-FR')
          : '-',
        referenceOF: prod.reference,
        productCode: prod.productCode,
        productName: prod.productName,
        quantityProduced: prod.quantityProduced || 0,
        unit: prod.productUnit,
        lotsConsumes: lotsConsumes || '-',
        rendement,
        responsable: prod.userFirstName || prod.userLastName
          ? `${prod.userFirstName || ''} ${prod.userLastName || ''}`.trim()
          : '-',
      });
    }

    return entries;
  }

  /**
   * Generate export in requested format
   */
  async generate(startDate: Date, endDate: Date, format: ExportFormat): Promise<Buffer> {
    const entries = await this.getProductionEntries(startDate, endDate);

    if (format === ExportFormat.EXCEL) {
      return this.generateExcel(entries, startDate, endDate);
    }
    return this.generatePdf(entries, startDate, endDate);
  }

  /**
   * Generate PDF version
   */
  private async generatePdf(
    entries: ProductionEntry[],
    startDate: Date,
    endDate: Date,
  ): Promise<Buffer> {
    const period = this.pdfGenerator.formatPeriod(startDate, endDate);
    const totalQty = entries.reduce((sum, e) => sum + e.quantityProduced, 0);

    const docDefinition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [30, 60, 30, 60],
      header: this.pdfGenerator.createHeader('JOURNAL DE PRODUCTION - PRODUITS FINIS', period),
      footer: this.pdfGenerator.createFooter(),
      content: [
        {
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', 'auto', '*', 'auto', 'auto', '*', 'auto', 'auto'],
            body: [
              [
                { text: 'Date', style: 'tableHeader' },
                { text: 'Réf. OF', style: 'tableHeader' },
                { text: 'Code', style: 'tableHeader' },
                { text: 'Produit', style: 'tableHeader' },
                { text: 'Qté Prod.', style: 'tableHeader' },
                { text: 'Unité', style: 'tableHeader' },
                { text: 'Lots MP Consommés', style: 'tableHeader' },
                { text: 'Rendement', style: 'tableHeader' },
                { text: 'Responsable', style: 'tableHeader' },
              ],
              ...entries.map((e) => [
                this.pdfGenerator.textCell(e.dateProduction),
                this.pdfGenerator.textCell(e.referenceOF),
                this.pdfGenerator.textCell(e.productCode),
                this.pdfGenerator.textCell(e.productName),
                { text: e.quantityProduced.toFixed(0), style: 'tableCellRight' },
                this.pdfGenerator.textCell(e.unit),
                { text: e.lotsConsumes, style: 'tableCell', fontSize: 7 },
                { text: e.rendement, style: 'tableCellRight' },
                this.pdfGenerator.textCell(e.responsable),
              ]),
              // Total row
              [
                { text: 'TOTAL PRODUIT', style: 'totalRow', colSpan: 4 },
                {}, {}, {},
                { text: totalQty.toFixed(0), style: 'totalRow', alignment: 'right' },
                { text: '', style: 'totalRow', colSpan: 4 },
                {}, {}, {},
              ],
            ],
          },
        },
        {
          text: `Nombre d'ordres de fabrication: ${entries.length}`,
          style: 'summary',
          margin: [0, 10, 0, 0],
        },
      ],
      styles: this.pdfGenerator.getDefaultStyles(),
      defaultStyle: { font: 'Roboto', fontSize: 8 },
    };

    return this.pdfGenerator.generatePdf(docDefinition);
  }

  /**
   * Generate Excel version
   */
  private async generateExcel(
    entries: ProductionEntry[],
    startDate: Date,
    endDate: Date,
  ): Promise<Buffer> {
    const workbook = this.excelGenerator.createWorkbook();
    const period = this.excelGenerator.formatPeriod(startDate, endDate);
    const sheet = workbook.addWorksheet('Journal Production PF');

    this.excelGenerator.addHeader(sheet, 'JOURNAL DE PRODUCTION - PRODUITS FINIS', period, 9);

    const headerRow = sheet.getRow(6);
    headerRow.values = ['Date', 'Réf. OF', 'Code', 'Produit', 'Qté Produite', 'Unité', 'Lots MP Consommés', 'Rendement', 'Responsable'];
    this.excelGenerator.styleHeaderRow(headerRow);

    let rowIndex = 7;
    for (const entry of entries) {
      sheet.getRow(rowIndex).values = [
        entry.dateProduction,
        entry.referenceOF,
        entry.productCode,
        entry.productName,
        entry.quantityProduced,
        entry.unit,
        entry.lotsConsumes,
        entry.rendement,
        entry.responsable,
      ];
      rowIndex++;
    }

    // Total row
    const totalQty = entries.reduce((sum, e) => sum + e.quantityProduced, 0);
    const totalRow = sheet.getRow(rowIndex);
    totalRow.values = ['TOTAL', '', '', '', totalQty, '', '', '', ''];
    this.excelGenerator.styleTotalRow(totalRow);

    this.excelGenerator.autoFitColumns(sheet);

    return this.excelGenerator.generateBuffer(workbook);
  }
}
