# Manchengo Smart ERP — UI/UX Blueprint

**Version**: 1.0  
**Status**: FINAL  
**Date**: 2025-12-20  
**Target**: Figma Design + Flutter/Tauri Implementation

---

## Table of Contents

1. [Global Design System](#1-global-design-system)
2. [Mobile Android Screens](#2-mobile-android-screens)
3. [Desktop Screens](#3-desktop-screens)
4. [Role-Based Access Matrix](#4-role-based-access-matrix)
5. [User Flows](#5-user-flows)
6. [UX Rules](#6-ux-rules)

---

## 1. Global Design System

### 1.1 Color Palette

#### Primary Colors
| Name | Hex | Usage |
|------|-----|-------|
| **Manchengo Gold** | `#D4A84B` | Primary brand, CTAs, highlights |
| **Industrial Blue** | `#1E3A5F` | Headers, navigation, primary text |
| **Clean White** | `#FFFFFF` | Backgrounds, cards |
| **Soft Gray** | `#F5F7FA` | Secondary backgrounds, disabled states |

#### Status Colors
| Name | Hex | Usage |
|------|-----|-------|
| **Success Green** | `#22C55E` | Completed, validated, synced |
| **Warning Amber** | `#F59E0B` | Pending, attention needed |
| **Error Red** | `#EF4444` | Errors, blocking issues |
| **Offline Orange** | `#F97316` | Offline mode indicator |
| **Sync Blue** | `#3B82F6` | Syncing in progress |

#### Domain Colors
| Name | Hex | Usage |
|------|-----|-------|
| **MP Color** | `#8B5CF6` | Raw materials |
| **PF Color** | `#06B6D4` | Finished products |
| **Invoice Color** | `#10B981` | Invoices, payments |
| **Production Color** | `#F59E0B` | Production orders |

### 1.2 Typography

#### Mobile (Flutter - Roboto)
| Element | Size | Weight |
|---------|------|--------|
| H1 Screen Title | 24sp | Bold |
| H2 Section | 20sp | SemiBold |
| Body | 16sp | Regular |
| Caption | 14sp | Regular |
| Button | 16sp | SemiBold |

#### Desktop (Tauri - Inter)
| Element | Size | Weight |
|---------|------|--------|
| H1 Page Title | 28px | Bold |
| H2 Section | 22px | SemiBold |
| Body | 15px | Regular |
| Table | 14px | Regular |

### 1.3 Button Styles

- **Primary**: Gold background, white text, 8px radius
- **Secondary**: Transparent, blue border, blue text
- **Destructive**: Red background (with confirmation)
- **Touch target**: 44x44px minimum (mobile)

### 1.4 Status Indicators

- **● Synced**: Green dot
- **◐ Syncing**: Blue animated
- **○ Offline**: Orange hollow
- **✕ Error**: Red X

### 1.5 Icons

- **Set**: Lucide icons
- **Size**: 24px standard, 20px tables
- **Touch target**: 44x44px mobile

### 1.6 Spacing

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Inline |
| sm | 8px | Related items |
| md | 16px | Standard |
| lg | 24px | Sections |
| xl | 32px | Major sections |

---

## 2. Mobile Android Screens

### 2.1 Home Dashboard
- **Roles**: ALL
- **Purpose**: Overview and navigation
- **Components**: Stats cards, recent activity list
- **CTA**: "Scanner QR Code"

### 2.2 MP Reception
- **Roles**: APPRO, ADMIN
- **Purpose**: Register incoming raw materials
- **Components**: Supplier selector, BL input, article list
- **CTA**: "Valider Réception"

### 2.3 Production – Consume MP
- **Roles**: PRODUCTION, ADMIN
- **Purpose**: Record MP usage
- **Components**: Order selector, lot scanner, quantity inputs
- **CTA**: "Confirmer Consommation"

### 2.4 Production – Finish PF
- **Roles**: PRODUCTION, ADMIN
- **Purpose**: Complete production
- **Components**: Order summary, quantity input, date picker
- **CTA**: "Terminer Production"

### 2.5 Sales – Create Sale
- **Roles**: COMMERCIAL, ADMIN
- **Purpose**: Create sales with auto-pricing
- **Components**: Client selector, product list, totals
- **CTA**: "Créer Vente"

### 2.6 Invoice Details
- **Roles**: COMMERCIAL, COMPTABLE, ADMIN
- **Purpose**: View and share invoice
- **Components**: Invoice preview, totals with timbre
- **Actions**: "Partager PDF", "Imprimer"

### 2.7 Stock View (PF)
- **Roles**: ALL (read-only)
- **Purpose**: View available stock
- **Components**: Search, product cards with levels

### 2.8 Sync Status
- **Roles**: ALL
- **Purpose**: Monitor offline data
- **Components**: Connection status, pending queue, errors
- **CTA**: "Forcer Synchronisation"

### 2.9 Settings
- **Roles**: ADMIN (full), others (limited)
- **Purpose**: App configuration
- **Components**: Account info, admin sections, system options

---

## 3. Desktop Screens

### 3.1 Global Dashboard
- **Roles**: ADMIN
- **Layout**: Stats cards, stock overview, activity table
- **Filters**: Date range

### 3.2 Stock Management
- **Roles**: ADMIN, APPRO, PRODUCTION
- **Layout**: MP/PF toggle, product table, lot details
- **Filters**: Category, status, search
- **Actions**: Adjustment (ADMIN)

### 3.3 Production Orders
- **Roles**: ADMIN, PRODUCTION
- **Layout**: Orders table, detail panel
- **Filters**: Status, date
- **Actions**: Create, view, finalize

### 3.4 Sales & Invoices
- **Roles**: ADMIN, COMMERCIAL, COMPTABLE
- **Layout**: Toggle view, table, detail with line items
- **Filters**: Client, status, period
- **Actions**: Create, PDF, payment

### 3.5 Accounting / Fiscal
- **Roles**: ADMIN, COMPTABLE
- **Layout**: Period selector, summary cards, export list
- **Exports**: Sales journal, TVA G50, stock valuation

### 3.6 User Management
- **Roles**: ADMIN only
- **Layout**: User table, detail panel
- **Actions**: Create, edit, reset password, deactivate

### 3.7 System Settings
- **Roles**: ADMIN only
- **Layout**: Sections for company, fiscal, sync, print
- **Actions**: Save configuration

---

## 4. Role-Based Access Matrix

### Mobile Access

| Screen | ADMIN | APPRO | PROD | COMM | COMPTA |
|--------|:-----:|:-----:|:----:|:----:|:------:|
| Home | ✓ | ✓ | ✓ | ✓ | ✓ |
| Reception | ✓ | ✓ | — | — | — |
| Production | ✓ | — | ✓ | — | — |
| Sales | ✓ | — | — | ✓ | — |
| Invoice | ✓ | — | — | ✓ | Read |
| Stock | ✓ | ✓ | ✓ | ✓ | ✓ |
| Sync | ✓ | ✓ | ✓ | ✓ | ✓ |
| Settings | Full | Ltd | Ltd | Ltd | Ltd |

### Desktop Access

| Screen | ADMIN | APPRO | PROD | COMM | COMPTA |
|--------|:-----:|:-----:|:----:|:----:|:------:|
| Dashboard | ✓ | — | — | — | — |
| Stock MP | ✓ | ✓ | Read | — | Read |
| Stock PF | ✓ | Read | ✓ | Read | Read |
| Production | ✓ | — | ✓ | — | Read |
| Sales | ✓ | — | — | ✓ | Read |
| Invoices | ✓ | — | — | ✓ | ✓ |
| Accounting | ✓ | — | — | — | ✓ |
| Users | ✓ | — | — | — | — |
| Settings | ✓ | — | — | — | — |

---

## 5. User Flows

### 5.1 MP Reception (Mobile)
1. Open app → Home
2. Tap "Réception" or scan
3. Select/scan supplier
4. Enter supplier BL number
5. Add articles (scan or search)
6. Enter quantities per article
7. Review totals
8. Tap "Valider Réception"
9. SUCCESS → Lots created
10. Option: Print lot labels

### 5.2 Production Consumption (Mobile)
1. Open app → Production
2. Select order or scan QR
3. Scan MP lot QR
4. Enter quantity to consume
5. Repeat for each MP
6. Review consumptions
7. Tap "Confirmer"
8. Stock decremented (FIFO)

### 5.3 Sale & Invoice (Mobile)
1. Open app → Ventes
2. Select client (prices auto-apply)
3. Add products (scan or search)
4. Adjust quantities
5. Review totals (auto-calculated)
6. Tap "Créer Vente"
7. Select payment method
8. If cash: timbre added
9. Generate invoice
10. Share PDF (WhatsApp/Email)

### 5.4 Sync Recovery
1. Device reconnects
2. Sync icon shows "Syncing"
3. Pending items uploaded
4. Conflicts detected (if any)
5. User resolves conflicts
6. Sync complete
7. Status shows "Synced"

---

## 6. UX Rules

### 6.1 Core Principles
- **1 screen = 1 action**
- **No ERP jargon** (use simple French)
- **Automatic calculations** (TVA, timbre, totals)
- **Clear blocking errors** (red, disabled CTA)
- **Confirmation after critical actions**

### 6.2 Offline Behavior
- Always visible offline indicator (top right)
- All core actions work offline
- Data queued automatically
- Auto-sync when online
- User can force sync

### 6.3 Error Handling
- **Insufficient stock**: Red banner, CTA disabled
- **Validation error**: Field highlighted, message below
- **Sync conflict**: Dedicated screen with resolution
- **Network error**: Toast with retry option

### 6.4 Confirmations Required
- Validate reception
- Confirm consumption
- Finalize production
- Create invoice
- Record payment
- Delete anything

### 6.5 Mobile-Specific
- One-hand usage priority
- Large touch targets (44px+)
- QR scan as primary input
- Minimal typing required
- Swipe actions for lists

### 6.6 Desktop-Specific
- Keyboard shortcuts
- Bulk actions in tables
- Export to Excel/PDF
- Print support
- Multi-tab navigation

### 6.7 ADMIN-Only Features
- View cost data
- Stock adjustments
- User management
- System settings
- All fiscal exports

---

**END OF DOCUMENT**

This blueprint is FINAL and ready for Figma design and Flutter/Tauri implementation.
