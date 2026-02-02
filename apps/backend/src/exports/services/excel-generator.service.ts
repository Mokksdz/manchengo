import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { CompanyInfo } from '../dto/export.dto';

/**
 * Excel Generator Service
 * 
 * Generates Excel files for fiscal exports.
 * Uses exceljs for server-side Excel generation.
 */
@Injectable()
export class ExcelGeneratorService {
  // Manchengo company information
  readonly companyInfo: CompanyInfo = {
    name: 'SARL MANCHENGO',
    address: 'Zone Industrielle, Lot 15, Blida, Algérie',
    nif: '000000000000000',
    nis: '000000000000000',
    rc: '00/00-0000000B00',
    ai: '00000000000',
    phone: '+213 25 XX XX XX',
    email: 'contact@manchengo.dz',
  };

  /**
   * Create a new workbook with standard styling
   */
  createWorkbook(): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Manchengo Smart ERP';
    workbook.created = new Date();
    return workbook;
  }

  /**
   * Add header rows to worksheet
   */
  addHeader(
    worksheet: ExcelJS.Worksheet,
    title: string,
    period: string,
    columnCount: number,
  ): void {
    // Company name (merged across all columns)
    worksheet.mergeCells(1, 1, 1, columnCount);
    const companyRow = worksheet.getRow(1);
    companyRow.getCell(1).value = this.companyInfo.name;
    companyRow.getCell(1).font = { bold: true, size: 14 };
    companyRow.getCell(1).alignment = { horizontal: 'center' };

    // Company fiscal info
    worksheet.mergeCells(2, 1, 2, columnCount);
    const fiscalRow = worksheet.getRow(2);
    fiscalRow.getCell(1).value = `NIF: ${this.companyInfo.nif} | RC: ${this.companyInfo.rc}`;
    fiscalRow.getCell(1).font = { size: 9, color: { argb: 'FF666666' } };
    fiscalRow.getCell(1).alignment = { horizontal: 'center' };

    // Document title
    worksheet.mergeCells(3, 1, 3, columnCount);
    const titleRow = worksheet.getRow(3);
    titleRow.getCell(1).value = title;
    titleRow.getCell(1).font = { bold: true, size: 12 };
    titleRow.getCell(1).alignment = { horizontal: 'center' };

    // Period
    worksheet.mergeCells(4, 1, 4, columnCount);
    const periodRow = worksheet.getRow(4);
    periodRow.getCell(1).value = period;
    periodRow.getCell(1).font = { italic: true, size: 10 };
    periodRow.getCell(1).alignment = { horizontal: 'center' };

    // Empty row
    worksheet.getRow(5).height = 10;
  }

  /**
   * Style header row (column headers)
   */
  styleHeaderRow(row: ExcelJS.Row): void {
    row.font = { bold: true, size: 9 };
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF0F0F0' },
    };
    row.alignment = { horizontal: 'center', vertical: 'middle' };
    row.height = 20;
  }

  /**
   * Style total row
   */
  styleTotalRow(row: ExcelJS.Row): void {
    row.font = { bold: true, size: 9 };
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
  }

  /**
   * Format amount from centimes to DA
   */
  formatAmount(centimes: number): number {
    return centimes / 100;
  }

  /**
   * Format date for Algerian documents
   */
  formatDate(date: Date): string {
    return date.toLocaleDateString('fr-DZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  /**
   * Format period range
   */
  formatPeriod(startDate: Date, endDate: Date): string {
    return `Du ${this.formatDate(startDate)} au ${this.formatDate(endDate)}`;
  }

  /**
   * Generate Excel buffer from workbook
   */
  async generateBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Set column widths based on content
   */
  autoFitColumns(worksheet: ExcelJS.Worksheet, minWidth = 10, maxWidth = 50): void {
    worksheet.columns.forEach((column) => {
      let maxLength = minWidth;
      column.eachCell?.({ includeEmpty: true }, (cell) => {
        const cellValue = cell.value?.toString() || '';
        maxLength = Math.max(maxLength, Math.min(cellValue.length + 2, maxWidth));
      });
      column.width = maxLength;
    });
  }

  /**
   * Apply number format to amount columns
   */
  applyAmountFormat(worksheet: ExcelJS.Worksheet, columnIndex: number): void {
    worksheet.getColumn(columnIndex).numFmt = '#,##0.00 "DA"';
    worksheet.getColumn(columnIndex).alignment = { horizontal: 'right' };
  }
}
