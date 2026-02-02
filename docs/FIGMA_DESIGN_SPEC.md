# Manchengo Smart ERP — Figma Design Specification

**Version**: 1.0  
**Status**: FINAL  
**Date**: 2025-12-20  
**Target**: Figma Implementation → Flutter (Mobile) + Tauri (Desktop)

---

## Figma File Structure

```
📁 Manchengo Smart ERP
├── 📄 Cover
├── 📄 1. Design System
│   ├── 1.1 Colors
│   ├── 1.2 Typography
│   ├── 1.3 Buttons
│   ├── 1.4 Inputs
│   ├── 1.5 Cards
│   ├── 1.6 Badges & Status
│   ├── 1.7 Icons
│   ├── 1.8 Spacing & Grid
│   └── 1.9 Shadows & Effects
├── 📄 2. Mobile Screens
│   ├── 2.1 Home Dashboard
│   ├── 2.2 MP Reception
│   ├── 2.3 Production - Consume
│   ├── 2.4 Production - Finish
│   ├── 2.5 Sales - Create
│   ├── 2.6 Invoice Details
│   ├── 2.7 Stock View
│   ├── 2.8 Sync Status
│   └── 2.9 Settings
├── 📄 3. Desktop Screens
│   ├── 3.1 Global Dashboard
│   ├── 3.2 Stock Management
│   ├── 3.3 Production Orders
│   ├── 3.4 Sales & Invoices
│   ├── 3.5 Accounting
│   ├── 3.6 User Management
│   └── 3.7 System Settings
├── 📄 4. User Flows
│   ├── 4.1 MP Reception Flow
│   ├── 4.2 Production Flow
│   ├── 4.3 Sale & Invoice Flow
│   └── 4.4 Sync Recovery Flow
├── 📄 5. Role Access Views
│   ├── 5.1 ADMIN View
│   ├── 5.2 APPRO View
│   ├── 5.3 PRODUCTION View
│   ├── 5.4 COMMERCIAL View
│   └── 5.5 COMPTABLE View
└── 📄 6. Components Library
```

---

## 1. Design System

### 1.1 Colors

#### Brand Colors
| Token | Hex | RGB | Usage |
|-------|-----|-----|-------|
| `brand-gold` | #D4A84B | 212, 168, 75 | Primary CTA, brand accent |
| `brand-gold-hover` | #C49A3D | 196, 154, 61 | Hover state |
| `brand-gold-light` | #F5ECD9 | 245, 236, 217 | Light background |
| `brand-blue` | #1E3A5F | 30, 58, 95 | Headers, navigation |
| `brand-blue-light` | #2D4A6F | 45, 74, 111 | Hover state |

#### Neutral Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `neutral-white` | #FFFFFF | Backgrounds, cards |
| `neutral-50` | #F9FAFB | Page background |
| `neutral-100` | #F3F4F6 | Disabled backgrounds |
| `neutral-200` | #E5E7EB | Borders, dividers |
| `neutral-300` | #D1D5DB | Placeholder text |
| `neutral-400` | #9CA3AF | Secondary text |
| `neutral-500` | #6B7280 | Body text |
| `neutral-600` | #4B5563 | Headings |
| `neutral-700` | #374151 | Primary text |
| `neutral-800` | #1F2937 | Dark text |
| `neutral-900` | #111827 | Darkest text |

#### Status Colors
| Token | Hex | Usage | Light Variant |
|-------|-----|-------|---------------|
| `success` | #22C55E | Completed, synced | #DCFCE7 |
| `warning` | #F59E0B | Attention, pending | #FEF3C7 |
| `error` | #EF4444 | Errors, critical | #FEE2E2 |
| `info` | #3B82F6 | Information, syncing | #DBEAFE |
| `offline` | #F97316 | Offline indicator | #FFEDD5 |

#### Domain Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `domain-mp` | #8B5CF6 | Matière Première |
| `domain-pf` | #06B6D4 | Produit Fini |
| `domain-invoice` | #10B981 | Factures |
| `domain-production` | #F59E0B | Production |

### 1.2 Typography

#### Font Families
- **Mobile**: Roboto (Google Fonts)
- **Desktop**: Inter (Google Fonts)

#### Mobile Type Scale (Roboto)
| Token | Size | Weight | Line Height | Letter Spacing |
|-------|------|--------|-------------|----------------|
| `mobile-h1` | 24sp | 700 | 32sp | -0.5px |
| `mobile-h2` | 20sp | 600 | 28sp | -0.25px |
| `mobile-h3` | 18sp | 500 | 24sp | 0 |
| `mobile-body` | 16sp | 400 | 24sp | 0.15px |
| `mobile-body-medium` | 16sp | 500 | 24sp | 0.15px |
| `mobile-caption` | 14sp | 400 | 20sp | 0.25px |
| `mobile-small` | 12sp | 400 | 16sp | 0.4px |
| `mobile-button` | 16sp | 600 | 24sp | 0.5px |

#### Desktop Type Scale (Inter)
| Token | Size | Weight | Line Height | Letter Spacing |
|-------|------|--------|-------------|----------------|
| `desktop-h1` | 28px | 700 | 36px | -0.5px |
| `desktop-h2` | 22px | 600 | 30px | -0.25px |
| `desktop-h3` | 18px | 500 | 26px | 0 |
| `desktop-body` | 15px | 400 | 22px | 0 |
| `desktop-body-medium` | 15px | 500 | 22px | 0 |
| `desktop-caption` | 13px | 400 | 18px | 0.1px |
| `desktop-small` | 12px | 400 | 16px | 0.2px |
| `desktop-button` | 14px | 600 | 20px | 0.3px |
| `desktop-table-header` | 13px | 600 | 18px | 0.5px |
| `desktop-table-cell` | 14px | 400 | 20px | 0 |

### 1.3 Buttons

#### Mobile Buttons
| Variant | Height | Padding | Border Radius |
|---------|--------|---------|---------------|
| Primary | 48px | 24px horizontal | 8px |
| Secondary | 48px | 24px horizontal | 8px |
| Danger | 48px | 24px horizontal | 8px |
| Icon Button | 48×48px | — | 8px |
| FAB | 56×56px | — | 16px |

#### Desktop Buttons
| Variant | Height | Padding | Border Radius |
|---------|--------|---------|---------------|
| Primary | 40px | 20px horizontal | 6px |
| Secondary | 40px | 20px horizontal | 6px |
| Danger | 40px | 20px horizontal | 6px |
| Small | 32px | 12px horizontal | 4px |
| Icon Button | 36×36px | — | 6px |

#### Button States (All Variants)

**Primary Button**
```
Default:    bg: brand-gold       text: white
Hover:      bg: brand-gold-hover text: white
Pressed:    bg: #B38A35          text: white
Disabled:   bg: neutral-200      text: neutral-400
Loading:    bg: brand-gold       text: white + spinner
```

**Secondary Button**
```
Default:    bg: transparent      border: brand-blue    text: brand-blue
Hover:      bg: brand-blue       border: brand-blue    text: white
Pressed:    bg: brand-blue-light border: brand-blue    text: white
Disabled:   bg: transparent      border: neutral-300   text: neutral-400
```

**Danger Button**
```
Default:    bg: error            text: white
Hover:      bg: #DC2626          text: white
Pressed:    bg: #B91C1C          text: white
Disabled:   bg: neutral-200      text: neutral-400
```

### 1.4 Input Fields

#### Mobile Inputs
| Property | Value |
|----------|-------|
| Height | 56px |
| Border Radius | 8px |
| Padding | 16px |
| Label | Above field, 14sp, neutral-600 |
| Placeholder | neutral-400 |

#### Desktop Inputs
| Property | Value |
|----------|-------|
| Height | 40px |
| Border Radius | 6px |
| Padding | 12px |
| Label | Above field, 13px, neutral-600 |
| Placeholder | neutral-400 |

#### Input States
```
Default:    border: neutral-300    bg: white
Focus:      border: brand-gold     bg: white         shadow: 0 0 0 3px brand-gold-light
Error:      border: error          bg: error-light   + error message below
Disabled:   border: neutral-200    bg: neutral-100   text: neutral-400
```

#### Input Variants
- **Text Input**: Standard single line
- **Text Area**: Multi-line, min-height 120px
- **Number Input**: With +/- buttons
- **Search Input**: With search icon left
- **Select/Dropdown**: With chevron right
- **Date Picker**: With calendar icon right

### 1.5 Cards

#### Mobile Card
```
Background:     white
Border Radius:  12px
Shadow:         0 2px 8px rgba(0,0,0,0.08)
Padding:        16px
```

#### Desktop Card
```
Background:     white
Border Radius:  8px
Shadow:         0 1px 3px rgba(0,0,0,0.1)
Padding:        20px
```

#### Card Variants
- **Stat Card**: Icon + number + label
- **List Item Card**: Title + subtitle + action
- **Detail Card**: Header + content sections
- **Action Card**: Icon + label + chevron (navigation)

### 1.6 Badges & Status Indicators

#### Status Badges
| Badge | Background | Text | Icon |
|-------|------------|------|------|
| Synced | success-light | success | ✓ CheckCircle |
| Syncing | info-light | info | ◐ Loader (animated) |
| Offline | offline-light | offline | ○ WifiOff |
| Error | error-light | error | ✕ XCircle |

#### Stock Status Badges
| Badge | Background | Text | Icon |
|-------|------------|------|------|
| Stock OK | success-light | success | ✓ Check |
| Stock Bas | warning-light | warning | ⚠ AlertTriangle |
| Stock Critique | error-light | error | 🔴 AlertCircle |
| Rupture | neutral-100 | neutral-500 | — Minus |

#### Role Badges
| Role | Background | Text |
|------|------------|------|
| ADMIN | brand-blue | white |
| APPRO | domain-mp | white |
| PRODUCTION | domain-production | white |
| COMMERCIAL | domain-pf | white |
| COMPTABLE | neutral-600 | white |

#### Badge Sizing
- **Mobile**: Height 24px, padding 8px, font 12sp
- **Desktop**: Height 20px, padding 6px, font 11px

### 1.7 Icons

#### Icon Set
Primary: **Lucide Icons** (https://lucide.dev)

#### Icon Sizes
| Context | Mobile | Desktop |
|---------|--------|---------|
| Navigation | 24px | 20px |
| Button inline | 20px | 18px |
| List item | 24px | 20px |
| Empty state | 48px | 40px |
| Status indicator | 16px | 14px |

#### Required Icons
```
Navigation:
- Home, Package, Factory, ShoppingCart, Settings
- ChevronLeft, ChevronRight, ChevronDown
- Menu, X, Search

Actions:
- Plus, Minus, Edit, Trash, Check, X
- Camera, QrCode, Scan
- Download, Upload, Share, Printer

Status:
- CheckCircle, AlertTriangle, XCircle, Info
- Wifi, WifiOff, RefreshCw, Loader

Domain:
- Package (MP), Box (PF), FileText (Invoice)
- Factory (Production), Users, Cog
```

### 1.8 Spacing System

#### Spacing Scale
| Token | Value | Usage |
|-------|-------|-------|
| `space-0` | 0px | — |
| `space-1` | 4px | Inline tight |
| `space-2` | 8px | Related items |
| `space-3` | 12px | Component padding |
| `space-4` | 16px | Standard gap |
| `space-5` | 20px | Section padding |
| `space-6` | 24px | Card padding |
| `space-8` | 32px | Section gap |
| `space-10` | 40px | Major sections |
| `space-12` | 48px | Page margins |

#### Grid System

**Mobile (360px - 428px)**
```
Margins:      16px
Columns:      4
Gutter:       16px
Content Max:  100%
```

**Desktop (1280px+)**
```
Margins:      24px (with sidebar)
Columns:      12
Gutter:       24px
Content Max:  1200px
Sidebar:      240px fixed
```

### 1.9 Shadows & Effects

#### Shadows
| Token | Value | Usage |
|-------|-------|-------|
| `shadow-sm` | 0 1px 2px rgba(0,0,0,0.05) | Subtle lift |
| `shadow-md` | 0 2px 8px rgba(0,0,0,0.08) | Cards |
| `shadow-lg` | 0 4px 16px rgba(0,0,0,0.12) | Modals, dropdowns |
| `shadow-focus` | 0 0 0 3px brand-gold-light | Focus rings |

#### Border Radius
| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 4px | Small elements |
| `radius-md` | 6px | Desktop buttons |
| `radius-lg` | 8px | Mobile buttons, inputs |
| `radius-xl` | 12px | Mobile cards |
| `radius-full` | 9999px | Pills, avatars |

---

## 2. Mobile Screens

### Frame Settings
- **Device**: Android Medium (360 × 800)
- **Scale**: 1x
- **Background**: neutral-50

### 2.1 Home Dashboard

**Frame**: `Mobile/Home`

#### Structure
```
┌─────────────────────────────────────┐
│ [AppBar]                            │ 56px
│ Logo          [SyncBadge] [Avatar]  │
├─────────────────────────────────────┤
│                                     │
│ [Greeting Section]                  │ 64px
│ "Bonjour, {Prénom}"                 │
│ [RoleBadge]                         │
│                                     │
│ [Stats Grid - 2×2]                  │ 180px
│ ┌─────────┐ ┌─────────┐            │
│ │ StatsCard│ │ StatsCard│            │
│ │ Réception│ │Production│            │
│ └─────────┘ └─────────┘            │
│ ┌─────────┐ ┌─────────┐            │
│ │ StatsCard│ │ StatsCard│            │
│ │  Ventes │ │  Stock  │            │
│ └─────────┘ └─────────┘            │
│                                     │
│ [Section Header]                    │ 40px
│ "Activités récentes"                │
│                                     │
│ [Activity List]                     │ flex
│ • ActivityItem                      │
│ • ActivityItem                      │
│ • ActivityItem                      │
│                                     │
├─────────────────────────────────────┤
│ [Primary CTA - Full Width]          │ 72px
│ "📷 SCANNER QR CODE"                │
├─────────────────────────────────────┤
│ [Bottom Navigation]                 │ 56px
│ 🏠  📦  🏭  🛒  ⚙️                   │
└─────────────────────────────────────┘
```

#### Components
- **AppBar**: Height 56px, brand-blue background
- **StatsCard**: 156×80px, white bg, shadow-md, radius-xl
- **ActivityItem**: Height 56px, icon + text + time
- **PrimaryCTA**: Height 48px, brand-gold, full width minus margins
- **BottomNav**: Height 56px, white bg, shadow-lg (top)

#### Role Variants
- ADMIN: All 4 stat cards visible
- APPRO: Only Réception + Stock
- PRODUCTION: Only Production + Stock
- COMMERCIAL: Only Ventes + Stock
- COMPTABLE: Only Stock (read icon)

---

### 2.2 MP Reception

**Frame**: `Mobile/Reception`

#### Structure
```
┌─────────────────────────────────────┐
│ [AppBar]                            │
│ [←] Nouvelle Réception   [Sync]     │
├─────────────────────────────────────┤
│                                     │
│ [Input: Fournisseur]                │
│ Label: "Fournisseur *"              │
│ Placeholder: "Rechercher..."  [🔍]  │
│                                     │
│ [Input: N° BL]                      │
│ Label: "N° BL Fournisseur *"        │
│ Placeholder: "Ex: BL-2024-1234"     │
│                                     │
│ [Divider + Section Header]          │
│ "Articles"                          │
│                                     │
│ [Article Card] (repeatable)         │
│ ┌─────────────────────────────────┐ │
│ │ Product name              [✕]  │ │
│ │ Quantité: [  input  ] unité    │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Add Button - Secondary]            │
│ "+ Ajouter article"                 │
│                                     │
│ [Summary Bar]                       │
│ Articles: X  │  Total: X unités     │
│                                     │
├─────────────────────────────────────┤
│ [Primary CTA]                       │
│ "✓ VALIDER RÉCEPTION"               │
└─────────────────────────────────────┘
```

#### States
- **Empty**: Show placeholder "Aucun article ajouté"
- **With Items**: Show article cards
- **Error**: Red border on invalid fields
- **Loading**: Spinner on CTA

---

### 2.3 Production - Consume MP

**Frame**: `Mobile/Production-Consume`

#### Structure
```
┌─────────────────────────────────────┐
│ [AppBar]                            │
│ [←] Consommer MP           [Sync]   │
├─────────────────────────────────────┤
│                                     │
│ [Order Info Card]                   │
│ Ordre: #P-241220-001                │
│ Produit: Manchengo 500g             │
│                                     │
│ [Scan Button - Large]               │
│ ┌─────────────────────────────────┐ │
│ │     📷 Scanner lot MP           │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Section Header]                    │
│ "Lots scannés"                      │
│                                     │
│ [Lot Card] (repeatable)             │
│ ┌─────────────────────────────────┐ │
│ │ ● Lait cru - L241218-001   [✕] │ │
│ │   Dispo: 200 L                  │ │
│ │   À utiliser: [___] L           │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Info Banner]                       │
│ ⓘ Stock calculé automatiquement    │
│                                     │
├─────────────────────────────────────┤
│ [Primary CTA]                       │
│ "✓ CONFIRMER CONSOMMATION"          │
└─────────────────────────────────────┘
```

#### Error State
```
[Error Banner - Full Width]
⚠️ Stock insuffisant
Lait: 50 L requis, 30 L disponibles
[CTA Disabled]
```

---

### 2.4 Production - Finish PF

**Frame**: `Mobile/Production-Finish`

#### Structure
```
┌─────────────────────────────────────┐
│ [AppBar]                            │
│ [←] Finaliser Production   [Sync]   │
├─────────────────────────────────────┤
│                                     │
│ [Order Summary Card]                │
│ Ordre: #P-241220-001                │
│ Produit: Manchengo 500g             │
│ Statut: [En cours ●]                │
│                                     │
│ [Section: MP Consommées]            │
│ • Lait cru: 150 L                   │
│ • Ferments: 5 kg                    │
│                                     │
│ [Divider]                           │
│                                     │
│ [Input: Quantité produite]          │
│ Label: "Quantité produite *"        │
│ [Large Number Input with +/-]       │
│ "unités"                            │
│                                     │
│ [Input: Date]                       │
│ Label: "Date de production"         │
│ [Date Picker]                       │
│                                     │
│ [Checkbox]                          │
│ ☑️ Imprimer étiquettes QR           │
│                                     │
├─────────────────────────────────────┤
│ [Primary CTA]                       │
│ "✓ TERMINER PRODUCTION"             │
└─────────────────────────────────────┘
```

---

### 2.5 Sales - Create Sale

**Frame**: `Mobile/Sales-Create`

#### Structure
```
┌─────────────────────────────────────┐
│ [AppBar]                            │
│ [←] Nouvelle Vente         [Sync]   │
├─────────────────────────────────────┤
│                                     │
│ [Input: Client]                     │
│ Label: "Client *"                   │
│ [Search Input]                      │
│ Type: DISTRIBUTEUR                  │
│                                     │
│ [Section Header]                    │
│ "Articles"                          │
│                                     │
│ [Product Card] (repeatable)         │
│ ┌─────────────────────────────────┐ │
│ │ Manchengo 500g             [✕] │ │
│ │ 850,00 DA/u                     │ │
│ │ [-] 10 [+]  = 8 500,00 DA       │ │
│ │ Stock: 45 ✓                     │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Add Button]                        │
│ "+ Ajouter produit"                 │
│                                     │
│ [Totals Card]                       │
│ Sous-total HT:    8 500,00 DA      │
│ TVA (19%):        1 615,00 DA      │
│ ─────────────────────────           │
│ Total TTC:       10 115,00 DA      │
│                                     │
├─────────────────────────────────────┤
│ [Primary CTA]                       │
│ "✓ CRÉER VENTE"                     │
└─────────────────────────────────────┘
```

---

### 2.6 Invoice Details

**Frame**: `Mobile/Invoice-Detail`

#### Structure
```
┌─────────────────────────────────────┐
│ [AppBar]                            │
│ [←] Facture #F-241220-001  [Sync]   │
├─────────────────────────────────────┤
│                                     │
│ [Invoice Header Card]               │
│ ┌─────────────────────────────────┐ │
│ │     MANCHENGO SARL              │ │
│ │   Facture N° F-241220-001       │ │
│ │   Date: 20/12/2024              │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Client Info]                       │
│ Client: Laiterie du Nord            │
│ NIF: 001234567890123                │
│                                     │
│ [Line Items]                        │
│ ─────────────────────────────────   │
│ Manchengo 500g                      │
│ 10 × 850,00 DA        8 500,00 DA  │
│                                     │
│ [Totals]                            │
│ Sous-total HT:      8 500,00 DA    │
│ TVA (19%):          1 615,00 DA    │
│ Total TTC:         10 115,00 DA    │
│                                     │
│ Paiement: ESPÈCES                   │
│ Timbre fiscal:        102,00 DA    │
│ ─────────────────────────────────   │
│ NET À PAYER:       10 217,00 DA    │
│                                     │
│ [Status Badge]                      │
│ [Payée ✓]                           │
│                                     │
├─────────────────────────────────────┤
│ [Action Row]                        │
│ [📤 Partager]    [🖨️ Imprimer]      │
└─────────────────────────────────────┘
```

---

### 2.7 Stock View (PF)

**Frame**: `Mobile/Stock-PF`

#### Structure
```
┌─────────────────────────────────────┐
│ [AppBar]                            │
│ [←] Stock Produits Finis   [Sync]   │
├─────────────────────────────────────┤
│ [Search Bar]                        │
│ 🔍 Rechercher produit...            │
├─────────────────────────────────────┤
│                                     │
│ [Stock Card] (repeatable)           │
│ ┌─────────────────────────────────┐ │
│ │ 🧀 Manchengo 500g               │ │
│ │ ███████████ 145 unités          │ │
│ │ Dernière prod: 20/12/2024       │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🧀 Manchengo 1kg                │ │
│ │ ██████░░░░░ 23 unités           │ │
│ │ ⚠️ Stock bas                     │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🧀 Fromage frais 250g           │ │
│ │ ██░░░░░░░░░ 8 unités            │ │
│ │ 🔴 Stock critique               │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

#### Stock Bar Component
```
Width: 100%
Height: 8px
Background: neutral-200
Fill: success (>50%), warning (20-50%), error (<20%)
Border Radius: radius-full
```

---

### 2.8 Sync Status

**Frame**: `Mobile/Sync`

#### Structure
```
┌─────────────────────────────────────┐
│ [AppBar]                            │
│ [←] Synchronisation        [●]      │
├─────────────────────────────────────┤
│                                     │
│ [Connection Card]                   │
│ ┌─────────────────────────────────┐ │
│ │ ✓ Connecté au serveur           │ │
│ │ Dernière sync: 10:23            │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Section: En attente (X)]           │
│                                     │
│ [Pending Item] (repeatable)         │
│ ┌─────────────────────────────────┐ │
│ │ ◐ Réception #R-241220-002       │ │
│ │   Créée hors ligne à 09:15      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Section: Erreurs (X)]              │
│                                     │
│ [Error Item] (repeatable)           │
│ ┌─────────────────────────────────┐ │
│ │ ✕ Vente #V-241220-003           │ │
│ │   Conflit: stock modifié        │ │
│ │   [Résoudre →]                  │ │
│ └─────────────────────────────────┘ │
│                                     │
├─────────────────────────────────────┤
│ [Primary CTA]                       │
│ "🔄 FORCER SYNCHRONISATION"         │
└─────────────────────────────────────┘
```

---

### 2.9 Settings

**Frame**: `Mobile/Settings`

#### Structure
```
┌─────────────────────────────────────┐
│ [AppBar]                            │
│ [←] Paramètres             [Sync]   │
├─────────────────────────────────────┤
│                                     │
│ [Section: Compte]                   │
│ ┌─────────────────────────────────┐ │
│ │ 👤 Ahmed Benali                 │ │
│ │    [ADMIN]                      │ │
│ │    [Se déconnecter]             │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Section: Appareil]                 │
│ ID: MCG-D-A1B2C3                    │
│ Version: 1.0.0                      │
│ Base locale: 245 Mo                 │
│                                     │
│ [Section: Administration] *ADMIN    │
│ ┌─────────────────────────────────┐ │
│ │ Utilisateurs               [→] │ │
│ │ Produits                   [→] │ │
│ │ Fournisseurs               [→] │ │
│ │ Clients                    [→] │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Section: Système]                  │
│ ┌─────────────────────────────────┐ │
│ │ Exporter données           [→] │ │
│ │ Vider cache                [→] │ │
│ │ À propos                   [→] │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

---

## 3. Desktop Screens

### Frame Settings
- **Resolution**: 1440 × 900 (MacBook 13")
- **Scale**: 1x
- **Background**: neutral-50
- **Sidebar**: 240px fixed

### Global Layout Template
```
┌────────────────────────────────────────────────────────────────────┐
│ [TopBar - 56px]                                                    │
│ Logo │ Search │ Sync │ User                                        │
├──────────┬─────────────────────────────────────────────────────────┤
│ [Sidebar]│ [Content Area]                                          │
│ 240px    │ Padding: 24px                                           │
│          │                                                         │
│ Nav Items│                                                         │
│          │                                                         │
│          │                                                         │
│          │                                                         │
│          │                                                         │
├──────────┴─────────────────────────────────────────────────────────┤
│ [StatusBar - 32px]                                                 │
│ Sync: ✓ │ Pending: 0 │ v1.0.0                                      │
└────────────────────────────────────────────────────────────────────┘
```

### 3.1 Global Dashboard

**Frame**: `Desktop/Dashboard`

#### Content Area
```
[Page Title Row]
"Tableau de bord"                     [Date Filter ▼]

[Stats Row - 4 cards]
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│Réceptions│ │Production │ │  Ventes  │ │ Factures │
│    12    │ │    8     │ │    15    │ │  850K DA │
│  +3 ↑    │ │  +2 ↑    │ │  +5 ↑    │ │  CA jour │
└──────────┘ └──────────┘ └──────────┘ └──────────┘

[Charts Row - 2 cards]
┌───────────────────────────┐ ┌───────────────────────────┐
│ Stock MP (bar chart)      │ │ Stock PF (bar chart)      │
│ [Visual: horizontal bars] │ │ [Visual: horizontal bars] │
└───────────────────────────┘ └───────────────────────────┘

[Table: Activité récente]
│ Heure │ Type       │ Référence     │ Utilisateur │ Statut │
│ 10:23 │ Réception  │ R-241220-001  │ Karim       │ ✓      │
│ 10:15 │ Vente      │ V-241220-003  │ Sara        │ ✓      │
│ 09:45 │ Production │ P-241220-002  │ Omar        │ ◐      │
```

---

### 3.2 Stock Management

**Frame**: `Desktop/Stock`

#### Content Area
```
[Page Title Row]
"Gestion des Stocks"    [MP ○][PF ●]    [+ Ajustement]

[Filter Bar]
🔍 Rechercher...  │ Catégorie: [Tous ▼] │ Statut: [Tous ▼]

[Table: Stock]
│ Produit        │ Stock │ Unité │ Valeur*    │ Statut      │
├────────────────┼───────┼───────┼────────────┼─────────────┤
│ Manchengo 500g │ 145   │ unité │ 123,250 DA │ ✓ OK        │
│ Manchengo 1kg  │ 23    │ unité │ 46,000 DA  │ ⚠️ Bas       │
│ Fromage frais  │ 8     │ unité │ 4,800 DA   │ 🔴 Critique  │

[Detail Panel - Right Side or Below]
┌────────────────────────────────────────────────────────┐
│ Manchengo 500g                                         │
│ ────────────────────────────────────────────────────── │
│ Lots en stock (FIFO)                                   │
│ │ Lot         │ Date prod  │ Qté │ DLC        │       │
│ │ L241215-001 │ 15/12/2024 │ 50  │ 15/03/2025 │       │
│ │ L241218-002 │ 18/12/2024 │ 45  │ 18/03/2025 │       │
└────────────────────────────────────────────────────────┘

* Valeur column visible only for ADMIN
```

---

### 3.3 Production Orders

**Frame**: `Desktop/Production`

#### Content Area
```
[Page Title Row]
"Ordres de Production"                     [+ Nouvel ordre]

[Filter Bar]
🔍 Rechercher...  │ Statut: [Tous ▼] │ Date: [Cette semaine ▼]

[Table: Production Orders]
│ Référence    │ Produit        │ Qté  │ Date   │ Statut   │
├──────────────┼────────────────┼──────┼────────┼──────────┤
│ P-241220-001 │ Manchengo 500g │ 100  │ 20/12  │ ◐ Cours  │
│ P-241220-002 │ Fromage frais  │ 50   │ 20/12  │ ○ Prévu  │
│ P-241219-003 │ Manchengo 1kg  │ 30   │ 19/12  │ ✓ Fini   │

[Detail Panel]
┌────────────────────────────────────────────────────────┐
│ Ordre: P-241220-001                                    │
│ Produit: Manchengo 500g                                │
│ Quantité: 100 unités                                   │
│ Statut: En cours                                       │
│ ────────────────────────────────────────────────────── │
│ MP Consommées:                                         │
│ │ Matière   │ Lot         │ Qté utilisée │            │
│ │ Lait cru  │ L241218-001 │ 150 L        │            │
│ ────────────────────────────────────────────────────── │
│ [Voir détails] [Finaliser]                             │
└────────────────────────────────────────────────────────┘
```

---

### 3.4 Sales & Invoices

**Frame**: `Desktop/Sales`

#### Content Area
```
[Page Title Row]
"Ventes & Factures"   [Ventes ○][Factures ●]   [+ Nouvelle]

[Filter Bar]
🔍 Client/Réf...  │ Statut: [Tous ▼] │ Période: [Ce mois ▼]

[Table: Invoices]
│ N° Facture   │ Client        │ Montant TTC │ Statut      │
├──────────────┼───────────────┼─────────────┼─────────────┤
│ F-241220-001 │ Laiterie Nord │ 10,217 DA   │ ✓ Payée     │
│ F-241220-002 │ Superette     │ 5,450 DA    │ ◐ Partielle │
│ F-241219-003 │ Fast Food     │ 3,200 DA    │ ○ Impayée   │

[Detail Panel]
┌────────────────────────────────────────────────────────┐
│ Facture: F-241220-001                                  │
│ Client: Laiterie du Nord                               │
│ NIF: 001234567890123                                   │
│ ────────────────────────────────────────────────────── │
│ │ Produit        │ Qté │ PU HT   │ Total HT   │       │
│ │ Manchengo 500g │ 10  │ 850 DA  │ 8,500 DA   │       │
│ ────────────────────────────────────────────────────── │
│ Sous-total HT:  8,500 DA                               │
│ TVA (19%):      1,615 DA                               │
│ Timbre:           102 DA                               │
│ TOTAL:         10,217 DA                               │
│ ────────────────────────────────────────────────────── │
│ [📄 PDF]  [🖨️ Imprimer]  [💰 Paiement]                  │
└────────────────────────────────────────────────────────┘
```

---

### 3.5 Accounting / Fiscal

**Frame**: `Desktop/Accounting`

#### Content Area
```
[Page Title Row]
"Comptabilité & Exports Fiscaux"

[Period Selector]
Du: [01/12/2024]  Au: [31/12/2024]     [Appliquer]

[Summary Cards - 3 columns]
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ CA HT        │ │ TVA Collectée│ │ Timbre Fiscal│
│ 1,250,000 DA │ │ 237,500 DA   │ │ 12,500 DA    │
└──────────────┘ └──────────────┘ └──────────────┘

[Export Cards List]
┌────────────────────────────────────────────────────────┐
│ 📊 Journal des ventes                    [Exporter]    │
│    Toutes les factures avec détail TVA                 │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ 📊 Déclaration TVA (G50)                 [Exporter]    │
│    Format compatible DGI Algérie                       │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ 📊 État des stocks                       [Exporter]    │
│    Valorisation FIFO au dernier jour                   │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ 📊 Mouvements de stock                   [Exporter]    │
│    Entrées/sorties détaillées par lot                  │
└────────────────────────────────────────────────────────┘
```

---

### 3.6 User Management

**Frame**: `Desktop/Users`

#### Content Area
```
[Page Title Row]
"Gestion des Utilisateurs"                 [+ Nouvel utilisateur]

[Filter Bar]
🔍 Rechercher...  │ Rôle: [Tous ▼] │ [✓] Actifs uniquement

[Table: Users]
│ Nom          │ Email              │ Rôle       │ Statut   │
├──────────────┼────────────────────┼────────────┼──────────┤
│ Ahmed Benali │ ahmed@manchengo.dz │ ADMIN      │ ● Actif  │
│ Karim Hadj   │ karim@manchengo.dz │ APPRO      │ ● Actif  │
│ Sara Mansouri│ sara@manchengo.dz  │ COMMERCIAL │ ● Actif  │
│ Omar Belkacem│ omar@manchengo.dz  │ PRODUCTION │ ● Actif  │
│ Fatima Ziani │ fatima@manchengo.dz│ COMPTABLE  │ ○ Inactif│

[Detail Panel]
┌────────────────────────────────────────────────────────┐
│ Karim Hadj                                             │
│ Email: karim@manchengo.dz                              │
│ Rôle: [APPRO]                                          │
│ Créé le: 01/06/2024                                    │
│ Dernière connexion: 20/12/2024 09:15                   │
│ ────────────────────────────────────────────────────── │
│ [✏️ Modifier] [🔒 Reset MDP] [🗑️ Désactiver]            │
└────────────────────────────────────────────────────────┘
```

---

### 3.7 System Settings

**Frame**: `Desktop/Settings`

#### Content Area
```
[Page Title Row]
"Paramètres Système"

[Section: Entreprise]
┌────────────────────────────────────────────────────────┐
│ Raison sociale: [Manchengo SARL                    ]   │
│ NIF:            [001234567890123                   ]   │
│ NIS:            [12345678901                       ]   │
│ RC:             [16/00-12345B24                    ]   │
│ Adresse:        [Zone industrielle, Blida         ]   │
└────────────────────────────────────────────────────────┘

[Section: Fiscalité]
┌────────────────────────────────────────────────────────┐
│ Taux TVA standard:  [19] %                             │
│ Taux TVA réduit:    [9] %                              │
│ Timbre fiscal:      [✓] Actif (Calcul auto 2025)       │
└────────────────────────────────────────────────────────┘

[Section: Synchronisation]
┌────────────────────────────────────────────────────────┐
│ Serveur central:    [https://sync.manchengo.dz    ]    │
│ Intervalle sync:    [5] minutes                        │
│ Mode hors-ligne:    [✓] Actif                          │
└────────────────────────────────────────────────────────┘

[Section: Impressions]
┌────────────────────────────────────────────────────────┐
│ Format facture:     [A4 ▼]                             │
│ Logo:               [📎 Télécharger]                   │
│ Pied de page:       [Merci de votre confiance    ]     │
└────────────────────────────────────────────────────────┘

                                        [Enregistrer]
```

---

## 4. User Flows

### 4.1 MP Reception Flow

**Frame**: `Flows/MP-Reception`

```
[Start]
   │
   ▼
┌─────────────────┐
│   Home Screen   │
│   Tap "Scanner" │
│   or "Réception"│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Reception Form  │──────────────────┐
│ - Select/Scan   │                  │
│   Supplier      │                  │
└────────┬────────┘                  │
         │                           │
         ▼                           │
┌─────────────────┐                  │
│ Enter BL Number │                  │
└────────┬────────┘                  │
         │                           │
         ▼                           │
┌─────────────────┐     ┌───────────┴───────────┐
│ Add Articles    │────►│ Scan/Search Product   │
│ Loop            │◄────│ Enter Quantity        │
└────────┬────────┘     └───────────────────────┘
         │
         ▼
┌─────────────────┐
│ Review Totals   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Tap "Valider"   │────►│ Offline?        │
└────────┬────────┘     │ Queue locally   │
         │              └────────┬────────┘
         ▼                       │
┌─────────────────┐              │
│ Success Toast   │◄─────────────┘
│ + Print Labels? │
└────────┬────────┘
         │
         ▼
      [End]
```

### 4.2 Production Consumption Flow

**Frame**: `Flows/Production`

```
[Start]
   │
   ▼
┌─────────────────┐
│ Production List │
│ Select Order    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Consume Screen  │
│ Order displayed │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Scan Lot QR     │────►│ Lot Info        │
│ Loop            │◄────│ Enter Quantity  │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │              ┌────────┴────────┐
         │              │ Stock Check     │
         │              │ Sufficient? ────┼──► Error Banner
         │              └────────┬────────┘    CTA Disabled
         │                       │ Yes
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│ Review          │◄────┤ All MP added    │
│ Consumptions    │     └─────────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Tap "Confirmer" │
│ Stock updated   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Finish now? ────┼──► Production Finish Screen
└────────┬────────┘
         │ No
         ▼
      [End]
```

### 4.3 Sale & Invoice Flow

**Frame**: `Flows/Sale-Invoice`

```
[Start]
   │
   ▼
┌─────────────────┐
│ Sales Screen    │
│ Select Client   │
│ (Prices auto)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Add Products    │────►│ Scan/Search     │
│ Loop            │◄────│ Adjust Qty      │
└────────┬────────┘     │ Stock checked   │
         │              └─────────────────┘
         ▼
┌─────────────────┐
│ Review Totals   │
│ HT + TVA = TTC  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Tap "Créer"     │
│ Stock reserved  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create Invoice? │──► No ──► [End]
└────────┬────────┘
         │ Yes
         ▼
┌─────────────────┐
│ Payment Method  │
│ ESPÈCES?────────┼──► Add Timbre Fiscal
│ CHEQUE/VIREMENT │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generate Invoice│
│ PDF Ready       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Share/Print     │
└────────┬────────┘
         │
         ▼
      [End]
```

### 4.4 Sync Recovery Flow

**Frame**: `Flows/Sync-Recovery`

```
[Device Reconnects]
         │
         ▼
┌─────────────────┐
│ Sync Icon:      │
│ ◐ Syncing...    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Upload Pending  │
│ Events          │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Conflict?                               │
│                                         │
│ ├─► No ──► Mark Synced ──► ✓ Complete   │
│ │                                       │
│ └─► Yes ──► Show Conflict Modal         │
│             ┌─────────────────────────┐ │
│             │ ⚠️ Conflit détecté       │ │
│             │ Vente #V-241220-003     │ │
│             │                         │ │
│             │ [Garder ma version]     │ │
│             │ [Version serveur]       │ │
│             └─────────────────────────┘ │
│                        │                │
│                        ▼                │
│             ┌─────────────────────────┐ │
│             │ Resolve & Retry         │ │
│             └─────────────────────────┘ │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│ Sync Complete   │
│ ● Online        │
└─────────────────┘
```

---

## 5. Role Access Views

### 5.1 ADMIN View
- **Mobile**: All screens accessible
- **Desktop**: All screens accessible
- **Special**: Cost columns visible, Settings full access

### 5.2 APPRO View
- **Mobile**: Home, Reception, Stock (read), Sync, Settings (limited)
- **Desktop**: Stock MP (full), Stock PF (read)
- **Hidden**: Production, Sales, Invoices, Accounting, Users

### 5.3 PRODUCTION View
- **Mobile**: Home, Production (both), Stock (read), Sync, Settings (limited)
- **Desktop**: Production (full), Stock PF (full), Stock MP (read)
- **Hidden**: Sales, Invoices, Accounting, Users, Reception

### 5.4 COMMERCIAL View
- **Mobile**: Home, Sales, Invoice, Stock (read), Sync, Settings (limited)
- **Desktop**: Sales & Invoices (full), Stock PF (read)
- **Hidden**: Production, Stock MP, Accounting, Users, Reception

### 5.5 COMPTABLE View
- **Mobile**: Home, Invoice (read), Stock (read), Sync, Settings (limited)
- **Desktop**: Sales (read), Invoices (read + payment), Accounting (full)
- **Hidden**: Production, Stock write, Users, Reception
- **Special**: Can record payments

### Visual Indicators for Disabled Actions
```
[Disabled Button]
- Background: neutral-100
- Text: neutral-400
- Cursor: not-allowed
- Tooltip: "Action non autorisée"

[Hidden Screen]
- Remove from navigation
- No bottom nav icon
- Redirect to Home if URL accessed
```

---

## 6. Developer Handoff Notes

### Component Naming Convention
```
Platform/Screen/Component/State

Examples:
- Mobile/Home/StatsCard/Default
- Mobile/Home/StatsCard/Loading
- Desktop/Stock/Table/Row/Selected
- Desktop/Stock/Table/Row/Hover
```

### Export Settings
- **Mobile**: Export @1x, @2x, @3x for Android
- **Desktop**: Export @1x, @2x for Retina
- **Icons**: SVG format
- **Images**: PNG format

### Spacing Notes
- Use Auto Layout in Figma
- Match spacing tokens exactly
- Test responsive behavior

### Color Mode
- Light mode only (v1.0)
- Dark mode: Future consideration

---

**END OF FIGMA SPECIFICATION**
