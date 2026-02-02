/**
 * Production Components
 * P0 Audit Corrections + A1-A5 UX Finition
 */

// P0.2: Bannière urgence
export { ProductionCriticalBanner } from './ProductionCriticalBanner';

// P0.3-P0.4: Panel risques supply chain
export { SupplyRisksPanel } from './SupplyRisksPanel';

// A1: Productions à risque
export { ProductionsAtRiskPanel } from './ProductionsAtRiskPanel';

// A3: Tooltip explicatif blocages
export { BlockReasonTooltip, BlockReasonInline, PlanningRiskBadge } from './BlockReasonTooltip';

// Modals (extracted for optimization)
export { ProductionWizardModal } from './ProductionWizardModal';
export { NewProductModal } from './NewProductModal';

// Tabs (extracted for optimization)
export { ProductionCalendarTab } from './ProductionCalendarTab';
export { ProductionAnalyticsTab } from './ProductionAnalyticsTab';
export { ProductionTraceabilityTab } from './ProductionTraceabilityTab';
export { ProductionDashboardTab } from './ProductionDashboardTab';
export { ProductionProductsTab } from './ProductionProductsTab';
export { ProductionOrdersTab } from './ProductionOrdersTab';

// Product Detail Tabs
export { ProductParamsTab } from './ProductParamsTab';
export { ProductRecipeTab } from './ProductRecipeTab';
export { ProductBatchTab } from './ProductBatchTab';
export { ProductHistoryTab } from './ProductHistoryTab';

// Types
export type {
  SupplyRisksData,
  MpCritiqueProduction,
  BcCritiqueProduction,
  FournisseurBloquant,
  MpRiskState,
  BcImpactLevel,
} from './ProductionCriticalBanner';

export type {
  ProductionsAtRiskData,
  ProductionAtRisk,
  ProductionRiskReason,
} from './ProductionsAtRiskPanel';
