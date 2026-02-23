# Manchengo Smart ERP — Infrastructure Freeze Policy

**Effective Date**: Immediately after WAR ROOM patches are merged
**Duration**: Until 5 pilot clients are live and stable (minimum 30 days)
**Enforced by**: Branch protection on `main` + team discipline

---

## What is Frozen

| Category | Status | Notes |
|----------|--------|-------|
| Kubernetes manifests | FROZEN | No replica, resource, or strategy changes |
| Docker images | FROZEN | Only rebuild on bug fix commits |
| CI/CD workflows | FROZEN | No new jobs, steps, or tools |
| Database schema | FROZEN | No new migrations unless critical bug |
| Dependencies | FROZEN | No npm install of new packages |
| Infrastructure (Redis, PG) | FROZEN | No version upgrades, config changes |
| Monitoring/Alerting | FROZEN | No new dashboards, alerting rules |
| New services/modules | BLOCKED | No new NestJS modules or microservices |

## What is Allowed

| Category | Status | Notes |
|----------|--------|-------|
| Bug fixes | ALLOWED | Hotfix branch -> PR -> review -> merge |
| Security patches | ALLOWED | Critical CVEs only, with rollback plan |
| UI text/translation fixes | ALLOWED | i18n corrections (fr.ts, ar.ts) |
| Documentation | ALLOWED | User guides, API docs |
| Test additions | ALLOWED | More tests = more stability |
| Environment variables | ALLOWED | Feature flags, config tuning |

## Git Branch Strategy During Freeze

```
main (protected, production)
  └── hotfix/xxx (bug fixes only)
      └── PR required, 1 approval minimum
```

**Rules:**
1. `main` is protected: no direct push
2. All changes via PR with at least 1 approval
3. PRs must pass CI (tests, lint, build)
4. No feature branches during freeze
5. Hotfix branches named `hotfix/description`

## Breaking the Freeze

To unfreeze a category, ALL conditions must be met:
1. 5 pilot clients are onboarded
2. At least 2 weeks of stable production data
3. Written justification in a GitHub Issue
4. Team approval (minimum 2 people)

## Emergency Procedures

If a critical production bug requires frozen infrastructure changes:
1. Create a GitHub Issue tagged `emergency`
2. Document the exact change needed
3. Get verbal approval from project lead
4. Apply the minimum change to fix the issue
5. Post-mortem within 24 hours

---

**Remember: The goal is to SELL, not to ENGINEER.**
Every hour spent on infrastructure is an hour not spent on getting pilot clients.
