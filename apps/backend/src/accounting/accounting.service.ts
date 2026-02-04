import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LoggerService } from '../common/logger/logger.service';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ACCOUNTING SERVICE — Journal Entries & Export
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Algerian Chart of Accounts (SCF - Systeme Comptable Financier):
 * - Class 1: Capital accounts
 * - Class 2: Fixed assets
 * - Class 3: Inventory accounts
 * - Class 4: Third-party accounts
 * - Class 5: Financial accounts
 * - Class 6: Expense accounts
 * - Class 7: Revenue accounts
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// Algerian Chart of Accounts (SCF)
export const CHART_OF_ACCOUNTS = {
  // Class 3 - Inventory
  STOCK_MP: '31', // Matieres premieres
  STOCK_PF: '35', // Produits finis
  STOCK_VARIATION_MP: '603', // Variation de stock MP
  STOCK_VARIATION_PF: '713', // Variation de stock PF

  // Class 4 - Third parties
  SUPPLIERS: '401', // Fournisseurs
  CLIENTS: '411', // Clients
  VAT_DEDUCTIBLE: '4456', // TVA deductible
  VAT_COLLECTED: '4457', // TVA collectee
  VAT_PAYABLE: '4458', // TVA a payer

  // Class 5 - Treasury
  BANK: '512', // Banque
  CASH: '53', // Caisse

  // Class 6 - Expenses
  PURCHASES_MP: '601', // Achats de matieres premieres
  EXTERNAL_SERVICES: '61', // Services externes
  STAMP_DUTY: '6411', // Timbre fiscal

  // Class 7 - Revenue
  SALES_PF: '701', // Ventes de produits finis
  PRODUCTION: '72', // Production stockee
};

export interface JournalEntry {
  date: Date;
  reference: string;
  description: string;
  lines: JournalEntryLine[];
}

export interface JournalEntryLine {
  accountCode: string;
  accountLabel: string;
  debit: number;
  credit: number;
  thirdPartyCode?: string;
  thirdPartyName?: string;
}

export interface ExportFilters {
  startDate: Date;
  endDate: Date;
  journalType?: 'SALES' | 'PURCHASES' | 'PRODUCTION' | 'ALL';
}

@Injectable()
export class AccountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════════
  // SALES JOURNAL ENTRIES
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Generate journal entries for sales invoices
   */
  async getSalesJournalEntries(filters: ExportFilters): Promise<JournalEntry[]> {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        date: {
          gte: filters.startDate,
          lte: filters.endDate,
        },
        status: 'PAID',
      },
      include: {
        client: { select: { code: true, name: true } },
      },
      orderBy: { date: 'asc' },
    });

    return invoices.map((invoice) => ({
      date: invoice.date,
      reference: invoice.reference,
      description: `Vente ${invoice.reference} - ${invoice.client.name}`,
      lines: [
        // Debit: Client account
        {
          accountCode: CHART_OF_ACCOUNTS.CLIENTS,
          accountLabel: 'Clients',
          debit: invoice.netToPay,
          credit: 0,
          thirdPartyCode: invoice.client.code,
          thirdPartyName: invoice.client.name,
        },
        // Credit: Sales revenue
        {
          accountCode: CHART_OF_ACCOUNTS.SALES_PF,
          accountLabel: 'Ventes de produits finis',
          debit: 0,
          credit: invoice.totalHt,
        },
        // Credit: VAT collected
        {
          accountCode: CHART_OF_ACCOUNTS.VAT_COLLECTED,
          accountLabel: 'TVA collectee',
          debit: 0,
          credit: invoice.totalTva,
        },
        // Credit: Stamp duty (if applicable)
        ...(invoice.timbreFiscal > 0
          ? [
              {
                accountCode: CHART_OF_ACCOUNTS.STAMP_DUTY,
                accountLabel: 'Timbre fiscal',
                debit: 0,
                credit: invoice.timbreFiscal,
              },
            ]
          : []),
      ],
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PURCHASES JOURNAL ENTRIES
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Generate journal entries for purchase orders (receptions)
   */
  async getPurchasesJournalEntries(filters: ExportFilters): Promise<JournalEntry[]> {
    const receptions = await this.prisma.receptionMp.findMany({
      where: {
        date: {
          gte: filters.startDate,
          lte: filters.endDate,
        },
        status: 'VALIDATED',
        supplierId: { not: null }, // Only external receptions with supplier
      },
      include: {
        supplier: { select: { code: true, name: true } },
        lines: true,
      },
      orderBy: { date: 'asc' },
    });

    return receptions
      .filter((r) => r.supplier !== null)
      .map((reception) => {
        const supplier = reception.supplier!;
        const totalHt = reception.lines.reduce((sum, l) => sum + (l.totalHT || 0), 0);
        const totalTva = reception.lines.reduce((sum, l) => sum + (l.tvaAmount || 0), 0);
        const totalTtc = reception.lines.reduce((sum, l) => sum + (l.totalTTC || 0), 0);

        return {
          date: reception.date,
          reference: reception.reference,
          description: `Achat ${reception.reference} - ${supplier.name}`,
        lines: [
          // Debit: Purchases account
          {
            accountCode: CHART_OF_ACCOUNTS.PURCHASES_MP,
            accountLabel: 'Achats de matieres premieres',
            debit: totalHt,
            credit: 0,
          },
          // Debit: VAT deductible
          {
            accountCode: CHART_OF_ACCOUNTS.VAT_DEDUCTIBLE,
            accountLabel: 'TVA deductible',
            debit: totalTva,
            credit: 0,
          },
          // Credit: Supplier account
          {
            accountCode: CHART_OF_ACCOUNTS.SUPPLIERS,
            accountLabel: 'Fournisseurs',
            debit: 0,
            credit: totalTtc,
            thirdPartyCode: supplier.code,
            thirdPartyName: supplier.name,
          },
        ],
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRODUCTION JOURNAL ENTRIES
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Generate journal entries for production (stock variation)
   */
  async getProductionJournalEntries(filters: ExportFilters): Promise<JournalEntry[]> {
    const productions = await this.prisma.productionOrder.findMany({
      where: {
        completedAt: {
          gte: filters.startDate,
          lte: filters.endDate,
        },
        status: 'COMPLETED',
      },
      include: {
        productPf: { select: { code: true, name: true } },
        lots: { select: { unitCost: true, quantityInitial: true } },
        consumptions: {
          include: {
            productMp: { select: { code: true, name: true } },
            lotMp: { select: { unitCost: true } },
          },
        },
      },
      orderBy: { completedAt: 'asc' },
    });

    return productions.map((production) => {
      // Calculate MP consumption cost
      const mpCost = production.consumptions.reduce((sum, c) => {
        const unitCost = c.lotMp?.unitCost || c.unitCost || 0;
        return sum + Number(c.quantityConsumed) * unitCost;
      }, 0);

      // Calculate PF production value
      const pfValue = production.lots.reduce((sum, lot) => {
        return sum + (lot.quantityInitial * (lot.unitCost || 0));
      }, 0);

      return {
        date: production.completedAt || new Date(),
        reference: production.reference,
        description: `Production ${production.reference} - ${production.productPf.name}`,
        lines: [
          // Debit: Stock PF (production entry)
          {
            accountCode: CHART_OF_ACCOUNTS.STOCK_PF,
            accountLabel: 'Stock produits finis',
            debit: pfValue,
            credit: 0,
          },
          // Credit: Production account
          {
            accountCode: CHART_OF_ACCOUNTS.PRODUCTION,
            accountLabel: 'Production stockee',
            debit: 0,
            credit: pfValue,
          },
          // Debit: Stock variation MP (consumption)
          {
            accountCode: CHART_OF_ACCOUNTS.STOCK_VARIATION_MP,
            accountLabel: 'Variation de stock MP',
            debit: mpCost,
            credit: 0,
          },
          // Credit: Stock MP
          {
            accountCode: CHART_OF_ACCOUNTS.STOCK_MP,
            accountLabel: 'Stock matieres premieres',
            debit: 0,
            credit: mpCost,
          },
        ],
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // EXPORT FORMATS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Export to PC Compta format (CSV)
   */
  async exportToPCCompta(filters: ExportFilters): Promise<string> {
    const entries = await this.getAllJournalEntries(filters);

    const lines: string[] = [];
    // PC Compta CSV header
    lines.push('DATE;JOURNAL;PIECE;COMPTE;LIBELLE;DEBIT;CREDIT;TIERS');

    let entryNumber = 1;
    for (const entry of entries) {
      for (const line of entry.lines) {
        lines.push(
          [
            this.formatDate(entry.date),
            this.getJournalCode(line.accountCode),
            `${entryNumber}`,
            line.accountCode,
            entry.description.substring(0, 50),
            line.debit > 0 ? (line.debit / 100).toFixed(2) : '',
            line.credit > 0 ? (line.credit / 100).toFixed(2) : '',
            line.thirdPartyCode || '',
          ].join(';'),
        );
      }
      entryNumber++;
    }

    return lines.join('\n');
  }

  /**
   * Export to Sage format (CSV)
   */
  async exportToSage(filters: ExportFilters): Promise<string> {
    const entries = await this.getAllJournalEntries(filters);

    const lines: string[] = [];
    // Sage CSV header
    lines.push('JournalCode;JournalLib;EcritureNum;EcritureDate;CompteNum;CompteLib;PieceRef;PieceDate;EcritureLib;Debit;Credit;Lettrage;DateLettrage;ValidDate;Montantdevise;Idevise');

    let entryNumber = 1;
    for (const entry of entries) {
      for (const line of entry.lines) {
        lines.push(
          [
            this.getJournalCode(line.accountCode),
            this.getJournalLabel(line.accountCode),
            entryNumber.toString().padStart(6, '0'),
            this.formatDateSage(entry.date),
            line.accountCode,
            line.accountLabel,
            entry.reference,
            this.formatDateSage(entry.date),
            entry.description,
            line.debit > 0 ? (line.debit / 100).toFixed(2).replace('.', ',') : '',
            line.credit > 0 ? (line.credit / 100).toFixed(2).replace('.', ',') : '',
            '', // Lettrage
            '', // DateLettrage
            this.formatDateSage(entry.date),
            '', // Montantdevise
            'DZD',
          ].join(';'),
        );
      }
      entryNumber++;
    }

    return lines.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // VAT DECLARATION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Generate VAT declaration data (G50)
   */
  async getVATDeclaration(filters: ExportFilters) {
    const [salesEntries, purchasesEntries] = await Promise.all([
      this.getSalesJournalEntries(filters),
      this.getPurchasesJournalEntries(filters),
    ]);

    // Calculate totals
    let salesHT = 0;
    let salesTVA = 0;
    let purchasesHT = 0;
    let purchasesTVA = 0;

    salesEntries.forEach((entry) => {
      entry.lines.forEach((line) => {
        if (line.accountCode === CHART_OF_ACCOUNTS.SALES_PF) {
          salesHT += line.credit;
        }
        if (line.accountCode === CHART_OF_ACCOUNTS.VAT_COLLECTED) {
          salesTVA += line.credit;
        }
      });
    });

    purchasesEntries.forEach((entry) => {
      entry.lines.forEach((line) => {
        if (line.accountCode === CHART_OF_ACCOUNTS.PURCHASES_MP) {
          purchasesHT += line.debit;
        }
        if (line.accountCode === CHART_OF_ACCOUNTS.VAT_DEDUCTIBLE) {
          purchasesTVA += line.debit;
        }
      });
    });

    const netTVA = salesTVA - purchasesTVA;

    return {
      period: {
        start: filters.startDate,
        end: filters.endDate,
      },
      sales: {
        totalHT: salesHT,
        totalTVA: salesTVA,
        invoiceCount: salesEntries.length,
      },
      purchases: {
        totalHT: purchasesHT,
        totalTVA: purchasesTVA,
        invoiceCount: purchasesEntries.length,
      },
      declaration: {
        tvaCollected: salesTVA,
        tvaDeductible: purchasesTVA,
        tvaNet: netTVA,
        tvaPayable: netTVA > 0 ? netTVA : 0,
        tvaCredit: netTVA < 0 ? Math.abs(netTVA) : 0,
      },
      generatedAt: new Date(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  private async getAllJournalEntries(filters: ExportFilters): Promise<JournalEntry[]> {
    const [sales, purchases, production] = await Promise.all([
      filters.journalType === 'ALL' || filters.journalType === 'SALES' || !filters.journalType
        ? this.getSalesJournalEntries(filters)
        : [],
      filters.journalType === 'ALL' || filters.journalType === 'PURCHASES' || !filters.journalType
        ? this.getPurchasesJournalEntries(filters)
        : [],
      filters.journalType === 'ALL' || filters.journalType === 'PRODUCTION' || !filters.journalType
        ? this.getProductionJournalEntries(filters)
        : [],
    ]);

    return [...sales, ...purchases, ...production].sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0].split('-').reverse().join('/');
  }

  private formatDateSage(date: Date): string {
    return date.toISOString().split('T')[0].replace(/-/g, '');
  }

  private getJournalCode(accountCode: string): string {
    if (accountCode.startsWith('7')) return 'VE'; // Ventes
    if (accountCode.startsWith('6')) return 'AC'; // Achats
    if (accountCode.startsWith('4')) return 'OD'; // Operations diverses
    return 'OD';
  }

  private getJournalLabel(accountCode: string): string {
    if (accountCode.startsWith('7')) return 'Journal des Ventes';
    if (accountCode.startsWith('6')) return 'Journal des Achats';
    return 'Operations Diverses';
  }
}
