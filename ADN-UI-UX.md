# ADN UI/UX — Manchengo Smart ERP

**Date:** 2026-02-24 (mis a jour Phase 5: WAR ROOM DEPLOYE)
**Score UX/UI:** 85/100 (+3 — ARIA, language switcher, modal fix deployes)
**Design Language:** Apple-inspired Glassmorphism ("Silicon Shell")
**Status:** Production Phase 5. Accessibilite ARIA deployee, language switcher FR/AR integre dans sidebar, modal overflow corrige.
**URL:** https://web-eight-wheat-19.vercel.app

---

## PHILOSOPHIE DE DESIGN

Manchengo Smart ERP adopte un langage de design **Apple-inspired glassmorphism** baptise "Silicon Shell". L'objectif est de creer une experience premium qui distingue le produit des ERP industriels classiques (interfaces grises et datees).

### Principes Fondateurs
1. **Clarte** — Hierarchie visuelle claire avec typographie Space Grotesk / Manrope
2. **Transparence** — Glassmorphism avec backdrop-blur et overlays semi-transparents
3. **Coherence** — Tokens de design centralises (225+ tokens dans `design-system.ts`)
4. **Accessibilite** — Focus trap, ARIA labels, reduced-motion respect

---

## PALETTE DE COULEURS

### Couleurs Texte (Hierarchie)
| Token | Hex | Usage |
|-------|-----|-------|
| `textPrimary` | #1D1D1F | Titres, contenus principaux |
| `textSecondary` | #6E6E73 | Sous-titres, labels |
| `textTertiary` | #86868B | Metadata, timestamps |
| `textQuaternary` | #AEAEB2 | Placeholders, disabled |

### Couleurs Status
| Token | Hex | Usage |
|-------|-----|-------|
| `statusSuccess` | #34C759 | Validation, stock sain |
| `statusWarning` | #FF9F0A | Alertes, seuils approches |
| `statusError` | #FF3B30 | Erreurs, stock critique |
| `statusInfo` | #007AFF | Information, sync |

### Couleur Marque
| Token | Hex | Usage |
|-------|-----|-------|
| `brandOrange` | #EC7620 | CTAs, accents, brand identity |

---

## TYPOGRAPHIE

### Fonts
- **Display:** Space Grotesk (var(--font-display)) — Titres, headers, KPI values
- **Body:** Manrope (var(--font-body)) — Corps de texte, labels, descriptions

### Echelle Typographique
| Token | Taille | Poids | Usage |
|-------|--------|-------|-------|
| `display` | 34px | Bold | Dashboard KPI values |
| `headline` | 17px | Semibold | Section headers |
| `body` | 15px | Regular | Paragraphes, descriptions |
| `caption` | 13px | Medium | Labels, metadata |
| `footnote` | 11px | Regular | Timestamps, footnotes |

---

## SYSTEME DE COMPOSANTS

### Glass Cards (Composant Principal)
```css
.glass-card {
  background: rgba(255, 255, 255, 0.60);
  backdrop-filter: blur(40px);
  border: 1px solid rgba(255, 255, 255, 0.50);
  border-radius: 28px;
  box-shadow: 0 12px 28px rgba(18, 22, 33, 0.08),
              inset 0 1px 0 rgba(255, 255, 255, 0.45);
}
```

### Variantes
| Classe | Usage | Effet |
|--------|-------|-------|
| `.glass-card` | Conteneur standard | Blur 40px, bg white/60 |
| `.glass-card-hover` | Carte interactive | Scale 1.01 au hover |
| `.silicon-shell` | Background page | Gradient subtil, fond de page |
| `.silicon-panel` | Panneau secondaire | Blur reduit, bg plus opaque |

### Spacing (Bento Grid)
| Token | Valeur | Usage |
|-------|--------|-------|
| `bento-sm` | 24px | Radius petites cartes |
| `bento-md` | 28px | Radius cartes standard |
| `bento-lg` | 32px | Radius grandes cartes |
| `bento-xl` | 40px | Radius conteneurs principaux |

---

## COMPOSANTS UI

### Button
```
Variants: primary (brand orange), secondary (ghost), destructive (red)
Sizes: sm (32px), md (40px), lg (48px)
States: default, hover, active, disabled, loading
Features: Icon support, loading spinner, full-width option
```

### Card
```
Variants: glass-card, glass-card-hover, stat-card
Features: Header slot, body, footer actions
Animations: Slide-up on mount, scale on hover
```

### Modal
```
Features: Focus trap, ARIA (aria-modal, aria-labelledby, aria-describedby)
Close: Escape key, backdrop click, X button
Sizes: sm (400px), md (500px), lg (600px)
Animation: Fade + scale on open/close
```

### Badge
```
Variants: success (green), warning (amber), error (red), info (blue), neutral (gray)
Sizes: sm, md
Features: Dot indicator, icon support
```

### ResponsiveTable
```
Desktop: Traditional table layout with sortable headers
Mobile: Card grid (2 columns) with key-value pairs
Breakpoint: lg (1024px)
Features: Loading skeleton, empty state, pagination
```

### StatCard
```
Features: React.memo optimized, sparkline chart
Display: Value (display font), label, trend indicator
Animation: Count-up on mount
```

---

## PATTERNS UX

### Navigation
- **Sidebar** collapsible avec sections groupees (dashed-border connectors)
- **Breadcrumbs** dans PageHeader
- **Command Palette** (Cmd+K) avec recherche globale
- **Role-based sections** — sidebar filtre par user.role
- **Active state** — section highlight + pulsing dot

### Data Display
- **3 Zone System** (Stock) — Critique (rouge), A Traiter (orange), Sante (vert)
- **KPI Cards** — Valeur + trend + sparkline
- **IRS Gauge** — Indicateur circulaire de risque stock (0-100)
- **Decision Cards** — Actions contextuelles avec consequences

### Forms
- **Modal-based** — Formulaires dans des modals (pas de pages dedicees)
- **Zod validation** — Schema validation cote client
- **Error display** — Messages sous chaque champ
- **Gap:** Pas de validation en temps reel (blur/change)

### Feedback
- **Sonner toasts** — Notifications success/error
- **Loading spinners** — Brand orange accent
- **Skeleton loaders** — Pour KPI grids et tables
- **Empty states** — Icon + titre + sous-titre + CTA

---

## ACCESSIBILITE

### Implemente
- Focus trap dans les modals (`useFocusTrap` hook)
- ARIA labels (modal: `aria-modal`, `aria-labelledby`, `aria-describedby`)
- Escape key handling (`useEscapeKey` hook)
- Skip to content (`<SkipToContent />` dans root layout)
- Live regions (`announce()` avec `aria-live="polite"`)
- Reduced motion (`prefers-reduced-motion: reduce` respecte)
- Keyboard shortcuts (Command Palette Cmd+K)

### Gaps
- Formulaires sans `<label>` HTML (placeholder only)
- Pas de `aria-current="page"` dans sidebar
- Status badges: couleur seule (pas d'icone fallback)
- Table rows clickables sans focus indicator visible
- Contraste WCAG potentiellement insuffisant (white/60 + #AEAEB2 = ~4.2:1)

---

## RESPONSIVE DESIGN

### Breakpoints
| Breakpoint | Largeur | Comportement |
|------------|---------|-------------|
| Mobile | < 768px | Sidebar drawer, mobile cards, stacked layout |
| Tablet | 768-1023px | Sidebar collapsed, hybrid layout |
| Desktop | 1024px+ | Sidebar visible, full tables, grid layout |

### Patterns Responsive
- **ResponsiveTable**: Table → Card grid sous 1024px
- **Sidebar**: Fixed → Drawer avec overlay sous 1024px
- **Header**: Glassmorphic bar fixe avec menu toggle
- **Modals**: max-w-lg (besoin de max-h-[90vh] pour mobile)

---

## INTERNATIONALISATION (i18n)

### Structure
```
lib/i18n/
├── index.ts    # Re-exports, formatters
├── fr.ts       # Traductions francaises
└── ar.ts       # Traductions arabes
```

### Fonctions
- `formatCurrency()` — Formatage monetaire locale-specific
- `formatDate()` — Formatage dates locale-specific
- `formatNumber()` — Formatage nombres locale-specific

### Problemes (mis a jour Phase 3)
1. ~~**RTL casse**~~ — **CORRIGE Phase 3** — `dir` dynamique via LanguageProvider, RTL CSS utilities ajoutees
2. **Pas de language switcher** dans l'UI (infra prete, UI a ajouter)
3. **Textes hardcodes** en francais dans les composants
4. ~~**Pas de LanguageContext**~~ — **CORRIGE Phase 3** — `LanguageProvider` + `useLanguage()` hook actif dans providers.tsx

---

## ANIMATIONS ET TRANSITIONS

### Definies dans globals.css
| Animation | Usage | Duree |
|-----------|-------|-------|
| `slide-up` | Card mount | 0.4s ease-out |
| `fade-in` | Modal backdrop | 0.2s ease |
| `pulse` | Loading indicator | 1s infinite |
| `bounce-subtle` | Notification badge | 0.3s |
| `shimmer` | Skeleton loader | 1.5s infinite |

### Respect Reduced Motion
Toutes les animations sont desactivees quand `prefers-reduced-motion: reduce` est actif.

---

## RECOMMANDATIONS UX PRIORITAIRES

### Fait (Phase 3 + Phase 4)
- [x] ~~Fixer RTL~~ — LanguageProvider avec `dir` dynamique + RTL CSS utilities
- [x] ~~Ajouter error recovery (retry button)~~ — QueryErrorState composant
- [x] ~~Form submission feedback~~ — useApiMutation avec toast.success/error (Sonner)
- [x] ~~ConfirmDialog sur actions destructives~~ — useConfirmDialog sur BC confirm + device revoke
- [x] ~~PWA experience~~ — **FAIT Phase 4** — OfflineIndicator, UpdatePrompt, InstallPrompt, PWAProvider
- [x] ~~Deploiement production~~ — **FAIT Phase 4** — https://web-eight-wheat-19.vercel.app

### High (Semaine prochaine)
5. Ajouter `<label>` HTML a tous les champs de formulaire
6. Language switcher dans sidebar header (infra LanguageProvider prete)
7. Back navigation sur pages detail
8. Fix modal overflow mobile (max-h-[90vh])
9. Ameliorer contraste sur fond glassmorphic

### Medium (Mois 2)
10. Onboarding tour pour nouveaux utilisateurs
11. Tooltips sur metriques complexes (IRS, rendement)
12. Dark mode support
13. Consolider design tokens (TS + CSS → single source)
14. Command Palette discoverable (search icon avec badge)

---

## PWA EXPERIENCE (NOUVEAU Phase 4)

### Composants PWA
| Composant | Description | Status |
|-----------|-------------|--------|
| **OfflineIndicator** | Banner amber fixe en bas-gauche "Mode hors ligne" avec icone WiFi barre | ✅ Actif |
| **UpdatePrompt** | Banner en bas-droite "Nouvelle version disponible" avec bouton brand orange | ✅ Actif |
| **InstallPrompt** | Banner centree en bas avec icone download, CTA "Installer" / "Plus tard" | ✅ Actif (delai 30s) |
| **PWAProvider** | Context React pour isOnline, isInstalled, canInstall, hasUpdate | ✅ Actif |

### Design PWA
- Install prompt utilise les couleurs brand (#F5A623 pour CTA, #FFF8E7 pour icone bg)
- Animations CSS: `animate-in slide-in-from-left` (offline), `slide-in-from-right` (update), `slide-in-from-bottom` (install)
- Dismiss persiste en sessionStorage
- Toast Sonner pour sync success ("Synchronisation terminee")

---

## CONCLUSION

Le design system de Manchengo est **visuellement premium** et **deploye en production**. La glassmorphism Apple-inspired cree une identite forte qui distingue le produit des ERP concurrents. Le produit offre une **experience native-like** grace au PWA (offline indicator, install prompt, background sync). La **Phase 4** a ajoute la couche production: security headers visibles dans les reponses HTTP, TLS 1.3, et PWA pleinement fonctionnel.

**Force principale:** Coherence visuelle et identite de marque forte
**Force Phase 3:** UX fonctionnelle robuste (error handling, toast feedback, confirm dialogs)
**Force Phase 4:** PWA native-like (offline, install, update prompts) + produit live en production
**Faiblesse restante:** Accessibilite (labels, contraste) et onboarding

---

*Rapport genere le 2026-02-22 — Agent 8 (UX/UI & Product)*
*Mis a jour le 2026-02-22 apres WAR ROOM Phase 3 (error handling, RTL, ConfirmDialog)*
*Mis a jour le 2026-02-23 apres Phase 4: Deploiement Production (PWA audit, experience native-like)*
