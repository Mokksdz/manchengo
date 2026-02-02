# 📱 ARCHITECTURE OFFLINE-FIRST - MANCHENGO SMART ERP

**Version**: 1.0 | **Date**: 7 Janvier 2026

---

# 🎯 1. RÉSUMÉ EXÉCUTIF

## Objectif
Architecture mobile **offline-first** pour utilisateurs terrain garantissant:
- **ZÉRO perte de données** | **ZÉRO duplication stock** | **Sync automatique**

## Règle d'or
```
📱 MOBILE = Collecteur intelligent (enregistre)
🖥️ SERVEUR = Moteur métier & Source de vérité (calcule, valide)
```

## Actions autorisées mobile

| Action | Autorisé | Stocké |
|--------|----------|--------|
| Scanner QR livraison | ✅ | Oui (pending) |
| Créer facture | ✅ | Oui (draft) |
| Consulter stock | ✅ | Cache RO |
| Modifier quantité stock | ❌ | **INTERDIT** |
| Valider production | ❌ | **INTERDIT** |

---

# 🏗️ 2. ARCHITECTURE GLOBALE

```
┌─────────────────── TERRAIN ───────────────────┐
│  📱 Vendeur  📱 Chauffeur  📱 Magasinier      │
│     │            │            │               │
│  [SQLite]    [SQLite]     [SQLite]           │
└────┼────────────┼────────────┼───────────────┘
     │   3G/WiFi  │  Instable  │
     ▼            ▼            ▼
┌─────────────── SERVEUR ──────────────────────┐
│  ┌──────────────────────────────────────┐    │
│  │         SYNC ENGINE (NestJS)         │    │
│  │  POST /push  GET /pull  GET /status  │    │
│  └─────────────────┬────────────────────┘    │
│                    │                          │
│  ┌─────────────────▼────────────────────┐    │
│  │    EVENT APPLIER (Idempotent)        │    │
│  │  • Server-wins stock • LWW autres    │    │
│  └─────────────────┬────────────────────┘    │
│                    ▼                          │
│            [ PostgreSQL ]                    │
└──────────────────────────────────────────────┘
```

## Flux PUSH (Mobile → Serveur)
1. Action utilisateur → Event créé avec UUID
2. Stocké dans `sync_queue` (PENDING)
3. Réseau OK → `POST /sync/push`
4. Serveur vérifie UUID (idempotent)
5. Applique event → ACK event_ids
6. Mobile purge events ACKés

## Flux PULL (Serveur → Mobile)
1. App start ou timer
2. `GET /sync/pull?since=X`
3. Serveur retourne events depuis X
4. Mobile applique au cache local
5. Update `last_sync_at`

---

# 🗄️ 3. MODÈLE DONNÉES OFFLINE (SQLite)

```sql
-- FILE D'ATTENTE SYNC
CREATE TABLE sync_queue (
    id              TEXT PRIMARY KEY,    -- UUID v4
    entity_type     TEXT NOT NULL,       -- 'DELIVERY', 'INVOICE'
    entity_id       TEXT NOT NULL,
    action          TEXT NOT NULL,       -- 'DELIVERY_VALIDATED'
    payload         TEXT NOT NULL,       -- JSON
    occurred_at     TEXT NOT NULL,       -- ISO8601
    user_id         TEXT NOT NULL,
    device_id       TEXT NOT NULL,
    status          TEXT DEFAULT 'PENDING', -- PENDING/SENDING/ACKED/FAILED
    retry_count     INTEGER DEFAULT 0,
    last_error      TEXT,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

-- MÉTADONNÉES SYNC
CREATE TABLE sync_meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
INSERT INTO sync_meta VALUES 
    ('last_pull_at', '1970-01-01T00:00:00Z'),
    ('device_id', '');

-- CACHE PRODUITS (Lecture seule)
CREATE TABLE cache_products_pf (
    id        INTEGER PRIMARY KEY,
    code      TEXT UNIQUE,
    name      TEXT,
    price_ht  INTEGER,
    is_active INTEGER DEFAULT 1
);

-- CACHE LIVRAISONS PENDING
CREATE TABLE cache_deliveries_pending (
    id          TEXT PRIMARY KEY,
    reference   TEXT,
    client_name TEXT,
    total_ttc   INTEGER,
    qr_payload  TEXT,
    status      TEXT DEFAULT 'PENDING'
);

-- BROUILLONS FACTURES
CREATE TABLE draft_invoices (
    id            TEXT PRIMARY KEY,
    client_id     INTEGER,
    total_ttc     INTEGER DEFAULT 0,
    status        TEXT DEFAULT 'DRAFT',
    sync_event_id TEXT
);

-- VALIDATIONS EN ATTENTE
CREATE TABLE pending_delivery_validations (
    id            TEXT PRIMARY KEY,
    delivery_id   TEXT,
    qr_scanned    TEXT,
    validated_at  TEXT,
    latitude      REAL,
    longitude     REAL,
    signature_path TEXT,
    status        TEXT DEFAULT 'PENDING'
);
```

---

# 🔄 4. ENDPOINTS SYNC (NestJS)

## POST /api/sync/push

```typescript
// Request
interface PushRequest {
  device_id: string;
  batch_id: string;  // Idempotence
  events: SyncEvent[];
}

interface SyncEvent {
  id: string;           // UUID
  entity_type: string;  // 'DELIVERY'
  entity_id: string;
  action: string;       // 'DELIVERY_VALIDATED'
  payload: Record<string, any>;
  occurred_at: string;  // ISO8601
  user_id: number;
  checksum: string;     // SHA256
}

// Response
interface PushResponse {
  success: boolean;
  acked_event_ids: string[];
  failed_events: {
    event_id: string;
    error_code: string;  // 'ALREADY_VALIDATED'
    retry: boolean;
    resolution?: { action: string; data?: any };
  }[];
  server_time: string;
}
```

## GET /api/sync/pull

```typescript
// Query: ?since=ISO8601&device_id=xxx&limit=100

// Response
interface PullResponse {
  events: ServerEvent[];
  has_more: boolean;
  server_time: string;
  device_status: {
    is_active: boolean;
    requires_reauth: boolean;
  };
}
```

## GET /api/sync/status

```typescript
// Response
interface StatusResponse {
  server_healthy: boolean;
  server_time: string;
  device: { is_active: boolean; pending_events: number };
  sync_required: boolean;
}
```

---

# ⚔️ 5. GESTION DES CONFLITS

| Entité | Règle | Raison |
|--------|-------|--------|
| **Stock** | 🔴 SERVEUR GAGNE | FIFO calculé serveur |
| **Livraison** | 🔴 FIRST-WINS | Une seule validation |
| **Facture** | 🟡 ACCEPT + ASSIGN REF | Serveur assigne référence |
| **Client** | 🟢 LWW | Non critique |
| **Audit** | 🟢 APPEND-ONLY | Jamais de conflit |

### Exemple: Double validation livraison

```
T1: Chauffeur A scanne QR offline (mobile A)
T2: Chauffeur B scanne même QR offline (mobile B)
T3: Mobile A sync → Serveur accepte
T4: Mobile B sync → CONFLIT: ALREADY_VALIDATED
    → Mobile B reçoit résolution: DISCARD_LOCAL
    → Notification: "Validée par Chauffeur A"
```

---

# 🔐 6. SÉCURITÉ OFFLINE

## JWT Strategy

| Token | Durée | Usage |
|-------|-------|-------|
| Access | 15 min | API calls |
| Refresh | 7 jours | Renouvellement |
| **Grace offline** | **72h** | Travail sans réseau |

Après 72h offline → Re-authentification obligatoire

## Device Management

- **Enregistrement**: UUID unique par device
- **Limite**: Max 3 devices par user
- **Révocation**: Admin peut révoquer à distance
- **Wipe**: Révocation = effacement données locales

## Protection

```
✅ Tokens dans SecureStorage (Keychain/Keystore)
✅ PIN optionnel pour accès prolongé offline
✅ Checksum SHA256 sur tous les payloads
✅ Détection tentatives fraude
```

---

# 💥 7. ROBUSTESSE CHAOS

| Scénario | Comportement | Récupération |
|----------|--------------|--------------|
| App killée pendant saisie | Draft auto-sauvé 5s | Reprendre |
| App killée pendant sync | Events PENDING | Retry |
| Téléphone éteint | SQLite persiste | Sync au boot |
| Double clic | UUID idempotent | Ignoré |
| Serveur down | Queue locale | Sync quand OK |
| Payload corrompu | Checksum invalide | Reject + log |

## Retry avec backoff exponentiel
```
Tentative 1: 1s
Tentative 2: 2s
Tentative 3: 4s
Tentative 4: 8s
Tentative 5: 16s (max)
```

---

# 📋 8. AUDIT OFFLINE

```typescript
interface LocalAuditEntry {
  id: string;              // UUID
  action: string;          // 'DELIVERY_SCANNED'
  entity_type: string;
  entity_id: string;
  user_id: string;
  device_id: string;
  occurred_at: string;     // Horloge client
  context: {
    app_version: string;
    battery_level: number;
    network_type: string;
    location?: { lat: number; lng: number };
  };
  payload_hash: string;    // SHA256
  synced: boolean;
}
```

**Preuve légale**: UUID + timestamps + hash + device_id + append-only

---

# 📅 9. PLAN IMPLÉMENTATION

## Phase 1: Backend (5j)
- J1: Refactoring sync.service.ts
- J2: Endpoint /sync/bootstrap
- J3: Gestion conflits event-applier
- J4-5: Tests unitaires + intégration

## Phase 2: Mobile Core (10j)
- J1-2: Setup Flutter + SQLite
- J3-4: Schéma complet
- J5-6: SyncEngine + retry
- J7: AuthManager offline
- J8: AuditService local
- J9-10: UI Scanner + Factures

## Phase 3: Durcissement (5j)
- Gestion conflits UI
- Mode batterie faible
- Révocation device
- Détection fraude

## Phase 4: Tests terrain (5j)
- Scénarios offline prolongé
- Tests chaos (kill app, réseau)
- Tests multi-device
- UAT utilisateurs réels

**Total: 25 jours/homme**

---

# 🧪 10. TESTS OBLIGATOIRES

## Scénarios terrain
- [ ] Création facture offline 24h → sync OK
- [ ] Validation livraison sans réseau → sync OK
- [ ] Double validation même BL → conflit géré
- [ ] App killée pendant sync → reprise OK
- [ ] 100 events en queue → sync batch OK
- [ ] Device révoqué → wipe local

## Tests non-régression
- [ ] Stock jamais modifié localement
- [ ] Pas de duplication events (UUID)
- [ ] Audit complet même offline
- [ ] Grace period 72h respectée

---

# ⚠️ 11. RISQUES & LIMITES

## Ce que l'architecture NE couvre PAS
- Sync temps réel (WebSocket)
- Merge complexe de factures
- Mode multi-utilisateur même device
- Travail offline > 7 jours

## Compromis assumés
- Stock en lecture seule sur mobile
- Validation livraison = irréversible
- Conflits = serveur décide

## Pièges à éviter
- ❌ Modifier stock côté mobile
- ❌ Ignorer les conflits
- ❌ Stocker tokens en clair
- ❌ Sync sans batch_id

---

# ✅ 12. CONCLUSION

## Verdict terrain
**OUI, livrable en production terrain** avec:
- Backend sync renforcé existant
- 25 jours d'implémentation mobile
- Tests terrain avant déploiement

## Risques business résiduels

| Risque | Probabilité | Mitigation |
|--------|-------------|------------|
| Conflit double validation | Moyenne | FIRST-WINS + notification |
| Perte event offline | Très faible | SQLite + retry infini |
| Device volé | Faible | Révocation + wipe |
| Horloge faussée | Faible | Drift check serveur |

## Prêt
- ✅ Backend sync existant
- ✅ Modèle événementiel
- ✅ Device management
- ✅ Audit trail

## À implémenter
- 📱 Application Flutter
- 🔄 SyncEngine complet
- 🧪 Tests terrain

## Prochaine étape
**Démarrer Phase 1**: Renforcement backend sync (5 jours)
