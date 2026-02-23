# Manchengo Smart ERP -- Pricing Strategy

**Market:** Algerian fromageries (cheese & dairy factories)
**Currency:** DZD (Algerian Dinar) | 1 EUR ~ 200 DZD
**Go-to-market:** Pilot program (3 months free) then conversion

---

## 1. Pricing Tiers

### Plan Starter -- Small Fromageries (5-15 employees)

| | |
|---|---|
| **Price** | 15,000 DZD/month (~75 EUR) |
| **Users** | 3 |
| **Devices** | 1 |
| **Products limit** | 500 |
| **Deliveries limit** | 100/month |

**Included modules:**
- Stock management
- Production tracking
- Dashboard & analytics

---

### Plan Pro -- Medium Fromageries (15-50 employees)

| | |
|---|---|
| **Price** | 35,000 DZD/month (~175 EUR) |
| **Users** | 10 |
| **Devices** | 5 |
| **Products limit** | 2,000 |
| **Deliveries limit** | Unlimited |

**Included modules:**
- Everything in Starter
- Deliveries with QR traceability
- Invoicing & billing
- Data exports (PDF, Excel, CSV)

---

### Plan Enterprise -- Large Operations (50+ employees)

| | |
|---|---|
| **Price** | Sur devis (custom quote) |
| **Users** | Unlimited |
| **Devices** | Unlimited |
| **Products limit** | Unlimited |
| **Deliveries limit** | Unlimited |

**Included modules:**
- Everything in Pro
- Multi-site management
- Dedicated support & onboarding
- Custom integrations (accounting, ERP bridges)
- SLA with guaranteed uptime

---

## 2. Pilot Program

The pilot program is designed to eliminate all friction for first-time SaaS buyers in the Algerian market.

| Parameter | Detail |
|---|---|
| **Duration** | 3 months |
| **Cost** | 100% free |
| **Features** | Full Pro plan |
| **Credit card required** | No |
| **Commitment** | None |
| **Conversion incentive** | "Pioneer" discount: -30% for the entire first year |

**Pilot flow:**

1. **Month 0** -- Onboarding: install, configure, train staff on-site
2. **Months 1-2** -- Active use with weekly check-ins and support
3. **Month 3** -- Review meeting: ROI assessment, pain points resolved, conversion discussion
4. **Month 4** -- Conversion to paying plan with Pioneer discount applied automatically

**Pioneer discount details:**
- Starter: 15,000 DZD --> 10,500 DZD/month for Year 1
- Pro: 35,000 DZD --> 24,500 DZD/month for Year 1
- Applies to the first 12 months of paid subscription
- Non-transferable, non-stackable

---

## 3. Revenue Projections (Starting with 5 Pilots)

### Monthly Recurring Revenue (MRR) Forecast

| Month | Active Pilots | Paying Customers | Plan Mix | MRR (DZD) | MRR (EUR) |
|---|---|---|---|---|---|
| M1 | 5 | 0 | Free (pilot) | 0 | 0 |
| M2 | 5 | 0 | Free (pilot) | 0 | 0 |
| M3 | 5 | 0 | Free (pilot) | 0 | 0 |
| M4 | 5 | 3 | 2 Starter + 1 Pro | 54,500* | ~273 |
| M5 | 5 | 3 | 2 Starter + 1 Pro | 54,500* | ~273 |
| M6 | 5 | 4 | 2 Starter + 2 Pro | 70,000* | ~350 |
| M9 | 8 | 6 | 3 Starter + 3 Pro | 105,000* | ~525 |
| M12 | 10 | 8 | 4 Starter + 4 Pro | 140,000* | ~700 |

*\* Pioneer discount (-30%) applied for Year 1 customers.*

### Without Pioneer Discount (Year 2+ Normalized)

| Scenario | Paying Customers | Plan Mix | MRR (DZD) | MRR (EUR) |
|---|---|---|---|---|
| Conservative | 8 | 4 Starter + 4 Pro | 200,000 | ~1,000 |
| Target | 15 | 8 Starter + 7 Pro | 365,000 | ~1,825 |
| Optimistic | 25 | 12 Starter + 10 Pro + 3 Enterprise | 530,000+ | ~2,650+ |

### Annual Revenue Trajectory

| Year | ARR (DZD) | ARR (EUR) | Notes |
|---|---|---|---|
| Year 1 | ~840,000 | ~4,200 | Pilot + Pioneer pricing, 8 paying customers |
| Year 2 | ~4,380,000 | ~21,900 | Full pricing, 15 customers target |
| Year 3 | ~8,400,000 | ~42,000 | 25+ customers, Enterprise tier active |

---

## 4. Why This Pricing Works

### Positioned below the pain threshold

Fromageries currently spend 20,000-50,000 DZD/month on paper-based record keeping, manual accountant fees, and lost inventory due to poor tracking. The Starter plan at 15,000 DZD is cheaper than the problem it solves.

### Simple per-plan model, not per-user

Per-user pricing is too complex and unpredictable for this market. Factory owners want a single, predictable monthly cost. They share logins informally already -- fighting this behavior would create friction. Instead, the user limit is generous enough to cover real needs.

### Monthly billing only (initially)

Annual billing requires too much trust from first-time SaaS buyers. Monthly billing:
- Reduces perceived risk
- Matches the cash-flow rhythm of fromageries (monthly production cycles)
- Builds trust incrementally

Annual billing can be introduced later (at a 15-20% discount) once the market matures.

### Offline-first is the differentiator

No competing ERP works reliably in zones with poor connectivity. Manchengo's offline-first architecture (Tauri desktop + local SQLite + background sync) means the software works even when the internet does not. This alone justifies the subscription cost for rural and semi-urban fromageries.

### No competitor at this price point

Generic ERPs in Algeria cost 300,000-1,000,000 DZD/year. Manchengo Pro at 420,000 DZD/year (full price) is at the very bottom of that range while being purpose-built for fromageries. Starter at 180,000 DZD/year has no competition at all.

---

## 5. Payment Methods

Payment collection in Algeria requires supporting non-digital methods, especially during the early adoption phase.

| Method | Priority | Details |
|---|---|---|
| **CCP (Algerie Poste)** | Primary | Most widely used. Transfer to business CCP account. Confirmation via receipt photo. |
| **Bank transfer (virement)** | Primary | Standard business-to-business. Works for Pro/Enterprise customers with formal accounting. |
| **Cash payment** | Transitional | Accepted for first 6 months only. Receipt provided. Goal: migrate all customers to digital within Year 1. |
| **Edahabia card** | Emerging | Algerie Poste's electronic payment card. Growing adoption. Integrate when volume justifies it. |
| **BaridiMob** | Future | Mobile payment via Algerie Poste. Monitor adoption rate, integrate in Year 2. |

### Payment collection process (Phase 1)

1. Invoice generated automatically on the 1st of each month
2. Customer pays via CCP or bank transfer within 10 days
3. Payment confirmed manually (receipt photo via WhatsApp or in-app)
4. Account status updated; late payments get a 7-day grace period
5. After 17 days unpaid: features limited to read-only mode
6. After 30 days unpaid: account suspended (data preserved for 90 days)

### Payment automation roadmap

- **Phase 1 (Launch):** Manual invoicing + manual confirmation
- **Phase 2 (M6-M12):** Semi-automated invoicing, payment reminders via SMS/WhatsApp
- **Phase 3 (Year 2):** Integration with Edahabia/BaridiMob for one-click payment

---

## 6. Competitive Positioning Summary

| Factor | Generic ERP | Manchengo Starter | Manchengo Pro |
|---|---|---|---|
| Annual cost | 300K-1M DZD | 180K DZD | 420K DZD |
| Industry-specific | No | Yes (fromagerie) | Yes (fromagerie) |
| Offline mode | No | Yes | Yes |
| Setup time | Weeks | 1 day | 1 day |
| Training needed | Heavy | Minimal | Minimal |
| Mobile access | Rare | Yes | Yes |
| QR traceability | No | No | Yes |
| French + Arabic UI | Sometimes | Yes | Yes |

---

## 7. Key Metrics to Track

| Metric | Target (Year 1) |
|---|---|
| Pilot-to-paid conversion rate | 60%+ |
| Monthly churn rate | < 5% |
| Average Revenue Per Account (ARPA) | 25,000 DZD/month |
| Customer Acquisition Cost (CAC) | < 50,000 DZD |
| Payback period | < 3 months |
| Net Promoter Score (NPS) | > 40 |
