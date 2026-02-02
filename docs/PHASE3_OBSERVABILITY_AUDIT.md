# PHASE 3: OBSERVABILITY & AUDITABILITY

**Date**: 5 Janvier 2026  
**Statut**: ✅ IMPLÉMENTÉ  
**Objectif**: Traçabilité forensique pour un ERP auditable

---

## 1. POURQUOI L'AUDIT EST CRITIQUE POUR UN ERP

### Valeur Business

| Scénario | Sans Audit | Avec Audit |
|----------|------------|------------|
| Stock manquant | "On ne sait pas" | "User X a fait mouvement Y à 14:32" |
| Fraude suspectée | Impossible à prouver | Preuves horodatées |
| Contrôle fiscal | Panique | Export des logs |
| Litige client | Parole contre parole | Trace irréfutable |

### Exigences Légales (Algérie)

- Conservation des traces comptables: **10 ans**
- Piste d'audit pour TVA
- Justification des mouvements de stock

---

## 2. ARCHITECTURE AUDIT

```
┌─────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST                            │
│                              │                                  │
│                    ┌─────────▼─────────┐                       │
│                    │ RequestIdMiddleware│ ← Génère X-Request-Id│
│                    └─────────┬─────────┘                       │
│                              │                                  │
│              ┌───────────────┼───────────────┐                 │
│              ▼               ▼               ▼                 │
│     ┌────────────┐   ┌────────────┐   ┌────────────┐          │
│     │StockService│   │ProductionS│   │ApproService│          │
│     └─────┬──────┘   └─────┬──────┘   └─────┬──────┘          │
│           │                │                │                  │
│           └────────────────┼────────────────┘                  │
│                            ▼                                   │
│                   ┌────────────────┐                           │
│                   │  AuditService  │ ← Log append-only         │
│                   └───────┬────────┘                           │
│                           ▼                                    │
│                   ┌────────────────┐                           │
│                   │  audit_logs    │ ← PostgreSQL table        │
│                   │  (immutable)   │                           │
│                   └────────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. MODÈLE DE DONNÉES AUDIT

### Schema Prisma

```prisma
model AuditLog {
  id           String         @id @default(uuid())
  
  // WHO - Qui a fait l'action
  actorId      String         @map("actor_id")
  actorRole    UserRole       @map("actor_role")
  actorEmail   String?        @map("actor_email")
  
  // WHAT - Quelle action
  action       AuditAction    // STOCK_MOVEMENT_CREATED, PRODUCTION_ORDER_COMPLETED, etc.
  severity     AuditSeverity  // INFO, WARNING, CRITICAL, SECURITY
  
  // ON WHAT - Sur quelle entité
  entityType   String         // "StockMovement", "ProductionOrder", etc.
  entityId     String         // "123", "OP-240105-001"
  
  // CONTEXT - Corrélation
  requestId    String?        // Pour tracer une action à travers les logs
  ipAddress    String?
  userAgent    String?
  
  // STATE - État avant/après pour forensique
  beforeState  Json?          // { stock: 100 }
  afterState   Json?          // { stock: 80, movementType: "OUT" }
  metadata     Json?          // Contexte additionnel
  
  // WHEN - Horodatage immuable
  timestamp    DateTime       @default(now())
  
  // INDEXES pour investigation
  @@index([actorId, timestamp])
  @@index([action, timestamp])
  @@index([entityType, entityId])
  @@index([requestId])
}
```

### Actions Auditées

| Catégorie | Action | Severity |
|-----------|--------|----------|
| **Stock** | STOCK_MOVEMENT_CREATED | INFO |
| **Stock** | STOCK_RECEPTION_CREATED | INFO |
| **Stock** | STOCK_INVENTORY_ADJUSTED | CRITICAL |
| **Production** | PRODUCTION_ORDER_CREATED | INFO |
| **Production** | PRODUCTION_ORDER_STARTED | INFO |
| **Production** | PRODUCTION_ORDER_COMPLETED | INFO |
| **Production** | PRODUCTION_ORDER_CANCELLED | WARNING |
| **Appro** | APPRO_DEMANDE_VALIDATED | INFO |
| **Appro** | APPRO_THRESHOLD_UPDATED | CRITICAL |
| **Security** | AUTH_LOGIN_SUCCESS | INFO |
| **Security** | AUTH_LOGIN_FAILED | SECURITY |
| **Security** | ACCESS_DENIED | SECURITY |
| **Security** | ROLE_VIOLATION | SECURITY |
| **Admin** | USER_DEACTIVATED | CRITICAL |
| **Override** | MANUAL_OVERRIDE | CRITICAL |

---

## 4. FICHIERS CRÉÉS

```
apps/backend/
├── prisma/
│   └── schema.prisma              # +AuditLog model, enums
├── src/
│   ├── common/
│   │   ├── audit/
│   │   │   ├── audit.service.ts   # Service principal
│   │   │   ├── audit.module.ts    # Module global
│   │   │   └── index.ts
│   │   └── middleware/
│   │       └── request-id.middleware.ts  # Injection X-Request-Id
│   ├── security/
│   │   └── audit.controller.ts    # Endpoint /api/security/audit
│   └── stock/
│       └── stock.service.ts       # Intégration audit
```

---

## 5. CORRÉLATION REQUEST ID

### Middleware

```typescript
// Chaque requête HTTP reçoit un ID unique
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = req.headers['x-request-id'] || uuidv4();
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
  }
}
```

### Usage

```typescript
// Le requestId suit l'action à travers tous les logs
await this.auditService.log({
  actor: { id: userId, role: userRole },
  action: AuditAction.STOCK_MOVEMENT_CREATED,
  entityType: 'StockMovement',
  entityId: String(movement.id),
  context: { requestId: req.requestId },
  // ...
});
```

---

## 6. EXEMPLE D'ENTRÉE AUDIT

### Stock Movement Créé

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "actorId": "user-123",
  "actorRole": "APPRO",
  "actorEmail": "stock@manchengo.dz",
  "action": "STOCK_MOVEMENT_CREATED",
  "severity": "INFO",
  "entityType": "StockMovement",
  "entityId": "4567",
  "requestId": "req-abc-123",
  "ipAddress": "192.168.1.100",
  "beforeState": {
    "stock": 150,
    "productId": 42,
    "productType": "MP"
  },
  "afterState": {
    "stock": 250,
    "movementType": "IN",
    "origin": "RECEPTION",
    "quantity": 100,
    "reference": "REC-20260105-001"
  },
  "timestamp": "2026-01-05T14:32:15.123Z"
}
```

### Violation de Rôle

```json
{
  "id": "x1y2z3...",
  "actorId": "user-456",
  "actorRole": "COMMERCIAL",
  "action": "ROLE_VIOLATION",
  "severity": "SECURITY",
  "entityType": "Authorization",
  "entityId": "RECEPTION",
  "metadata": {
    "reason": "Role COMMERCIAL attempted RECEPTION. Required: ADMIN, APPRO",
    "attemptedAction": "RECEPTION"
  },
  "timestamp": "2026-01-05T14:35:00.000Z"
}
```

---

## 7. ENDPOINT API

### GET /api/security/audit

Query logs avec filtres:

```bash
# Par utilisateur
GET /api/security/audit?actorId=user-123

# Par action
GET /api/security/audit?action=STOCK_MOVEMENT_CREATED

# Par période
GET /api/security/audit?from=2026-01-01&to=2026-01-05

# Par entité
GET /api/security/audit?entityType=ProductionOrder&entityId=OP-240105-001

# Pagination
GET /api/security/audit?page=2&limit=50
```

### GET /api/security/audit/security-events

Événements de sécurité récents:

```bash
GET /api/security/audit/security-events?hours=24&limit=100
```

---

## 8. INTÉGRATION DANS LES SERVICES

### StockService (Exemple)

```typescript
async createMovement(data, userId, userRole) {
  // 1. Capture état AVANT
  const stockBefore = await this.calculateStock(data.productType, data.productId);

  // 2. Exécuter l'action
  const movement = await this.prisma.stockMovement.create({ ... });

  // 3. Calculer état APRÈS
  const stockAfter = stockBefore + (data.movementType === 'IN' ? data.quantity : -data.quantity);

  // 4. Audit log (NEVER throws)
  await this.auditService.log({
    actor: { id: userId, role: userRole },
    action: AuditAction.STOCK_MOVEMENT_CREATED,
    severity: data.origin === 'INVENTAIRE' ? AuditSeverity.CRITICAL : AuditSeverity.INFO,
    entityType: 'StockMovement',
    entityId: String(movement.id),
    beforeState: { stock: stockBefore, productId: data.productId },
    afterState: { stock: stockAfter, quantity: data.quantity, origin: data.origin },
  });

  return movement;
}
```

---

## 9. PRINCIPES DE DESIGN

### 1. APPEND-ONLY

```typescript
// ❌ INTERDIT
await prisma.auditLog.update({ ... });
await prisma.auditLog.delete({ ... });

// ✅ AUTORISÉ
await prisma.auditLog.create({ ... });
await prisma.auditLog.findMany({ ... });
```

### 2. FAIL-SAFE

```typescript
// L'audit ne doit JAMAIS bloquer les opérations business
async log(entry: AuditLogEntry): Promise<void> {
  try {
    await this.prisma.auditLog.create({ data: ... });
  } catch (error) {
    // Log l'erreur mais NE THROW PAS
    this.logger.error('Failed to write audit log', error.stack);
  }
}
```

### 3. EXPLICIT > CLEVER

```typescript
// ✅ Explicite: on voit exactement ce qui est logué
beforeState: {
  stock: stockBefore,
  productId: data.productId,
  productType: data.productType,
}

// ❌ Clever mais opaque
beforeState: serializeFullObject(product)
```

---

## 10. MIGRATION

```bash
# Générer et appliquer la migration
cd apps/backend
npx prisma migrate dev --name add_audit_logs

# Ou en production
npx prisma migrate deploy
```

---

## 11. REQUÊTES D'INVESTIGATION

### Qui a modifié le stock du produit MP-42 ?

```sql
SELECT * FROM audit_logs 
WHERE entity_type = 'StockMovement' 
  AND (before_state->>'productId')::int = 42
ORDER BY timestamp DESC;
```

### Toutes les actions d'un utilisateur suspect

```sql
SELECT * FROM audit_logs 
WHERE actor_id = 'user-suspect-123'
ORDER BY timestamp DESC
LIMIT 100;
```

### Événements de sécurité des dernières 24h

```sql
SELECT * FROM audit_logs 
WHERE severity = 'SECURITY'
  AND timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;
```

---

## 12. RÉTENTION ET ARCHIVAGE

### Politique recommandée

| Type | Rétention | Action |
|------|-----------|--------|
| Security events | 5 ans | Archive cold storage |
| Stock movements | 10 ans | Conformité fiscale |
| Production orders | 10 ans | Traçabilité produits |
| General logs | 2 ans | Purge automatique |

### Script d'archivage (à implémenter Phase 4)

```sql
-- Archiver les logs de plus de 2 ans
INSERT INTO audit_logs_archive 
SELECT * FROM audit_logs 
WHERE timestamp < NOW() - INTERVAL '2 years';

-- Supprimer les logs archivés (UNIQUEMENT après confirmation archive)
DELETE FROM audit_logs 
WHERE timestamp < NOW() - INTERVAL '2 years';
```

---

## CONCLUSION

Phase 3 établit une **piste d'audit forensique** qui:

- ✅ Trace QUI a fait QUOI, QUAND, et sur QUOI
- ✅ Capture l'état AVANT et APRÈS chaque action
- ✅ Corrèle les logs via requestId
- ✅ Ne bloque jamais les opérations business
- ✅ Est requêtable pour investigation
- ✅ Répond aux exigences légales algériennes

**Si un auditeur demande "qui a fait ça ?", la réponse est dans les logs.**
