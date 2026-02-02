# 📊 MANCHENGO ERP — LOGGING PRODUCTION

> **Objectif:** Diagnostic clair d'un incident à 3h du matin

---

## 🎯 CHOIX DU LOGGER

### **Pino** — Retenu ✅

| Critère | Pino | Winston | Bunyan |
|---------|------|---------|--------|
| **Performance** | ⚡ 5x plus rapide | Moyen | Moyen |
| **JSON natif** | ✅ | ✅ | ✅ |
| **Intégration NestJS** | Native | Plugin | Plugin |
| **Taille bundle** | Légère | Lourde | Moyenne |
| **Production ready** | ✅ | ✅ | ✅ |

**Justification:** Pino est le logger le plus performant pour Node.js en production, avec output JSON natif parfait pour les outils d'agrégation (ELK, Datadog, CloudWatch).

---

## 📁 ARCHITECTURE

```
src/common/
├── logger/
│   └── logger.service.ts      # Logger principal (technique + métier)
└── middleware/
    └── correlation.middleware.ts  # Injection correlationId
```

---

## 🎚️ NIVEAUX DE LOG

| Niveau | Usage | Exemple |
|--------|-------|---------|
| **INFO** | Actions métier réussies | Demande créée, BC validé, Stock MAJ |
| **WARN** | Anormal mais géré | Retry Redis, Rendement < seuil |
| **ERROR** | Échec bloquant | DB down, Transition invalide |
| **DEBUG** | Dev uniquement | Détails requête (jamais en prod) |

---

## 📋 STRUCTURE DES LOGS

### Log Technique
```json
{
  "level": "INFO",
  "timestamp": "2026-01-12T14:30:00.000Z",
  "type": "technical",
  "module": "Cache",
  "message": "Redis connected: localhost:6379",
  "correlationId": "abc-123-def"
}
```

### Log Métier
```json
{
  "level": "INFO",
  "timestamp": "2026-01-12T14:30:00.000Z",
  "type": "business",
  "module": "ApproService",
  "action": "DEMANDE_VALIDATED",
  "userId": "user-456",
  "userEmail": "a***@manchengo.dz",
  "entityType": "DEMANDE",
  "entityId": 123,
  "correlationId": "abc-123-def",
  "duration": 45
}
```

---

## ✅ RÈGLES: QUOI LOGGER

### À LOGGER (INFO)
- ✅ Création d'entité (Demande, BC, Réception, Production)
- ✅ Changement de statut métier
- ✅ Validation / Rejet avec motif
- ✅ Connexion utilisateur réussie
- ✅ Génération document (PDF, Excel)

### À LOGGER (WARN)
- ⚠️ Rendement production < seuil tolérance
- ⚠️ Stock proche rupture
- ⚠️ Retry connexion externe
- ⚠️ Fallback activé (cache, service)
- ⚠️ Tentative action bloquée (verrou, idempotence)

### À LOGGER (ERROR)
- ❌ Exception non gérée
- ❌ Transition état invalide
- ❌ Conflit de version
- ❌ Échec connexion DB/Redis
- ❌ Échec sauvegarde critique

---

## 🚫 RÈGLES: NE JAMAIS LOGGER

| Donnée | Raison |
|--------|--------|
| **Mots de passe** | Sécurité |
| **Tokens JWT/API** | Sécurité |
| **Corps requête complet** | Risque données sensibles |
| **Numéros CB/CVV** | PCI-DSS |
| **Adresses personnelles** | RGPD |
| **Logs debug en prod** | Performance + bruit |

**Protection automatique:** Le `sanitizeMeta()` filtre automatiquement les clés sensibles.

---

## 💻 EXEMPLES D'UTILISATION

### 1. Log Technique Simple
```typescript
// ❌ AVANT (console.log)
console.log('[Cache] Redis connected');

// ✅ APRÈS (logger structuré)
this.logger.info('Redis connected: localhost:6379', 'Cache');
```

### 2. Log Métier avec Contexte
```typescript
// ❌ AVANT (console.log)
console.log(`Demande ${id} validée par ${userId}`);

// ✅ APRÈS (logger métier)
this.logger.businessInfo('DEMANDE_VALIDATED', {
  userId: req.user.id,
  userEmail: req.user.email,
  entityType: 'DEMANDE',
  entityId: id,
  correlationId: req.correlationId,
  duration: Date.now() - startTime,
});
```

### 3. Log Warning Métier
```typescript
// ❌ AVANT (console.warn)
console.warn(`Production ${ref}: rendement ${yield}% inférieur`);

// ✅ APRÈS (logger métier)
this.logger.businessWarn(
  'PRODUCTION_LOW_YIELD',
  `Rendement ${yieldPercentage.toFixed(1)}% inférieur à la tolérance`,
  {
    entityType: 'PRODUCTION',
    entityId: order.id,
    metadata: { reference: order.reference, yieldPercentage },
  },
);
```

### 4. Log Erreur avec Stack
```typescript
// ❌ AVANT (console.error)
console.error('Failed to save:', err);

// ✅ APRÈS (logger avec contexte)
this.logger.errorWithContext('Failed to save idempotency record', err, {
  service: 'IdempotencyMiddleware',
  method: 'saveIdempotencyRecord',
  correlationId: req.correlationId,
});
```

### 5. Logger avec Contexte Requête
```typescript
// Dans un controller ou service
const log = this.logger.forRequest(
  req.correlationId,
  req.user.id,
  req.user.email,
);

// Ensuite, utilisation simplifiée
log.info('DEMANDE_CREATED', 'DEMANDE', newDemande.id);
log.warn('STOCK_LOW', 'Stock proche rupture', 'LOT_MP', lotId);
log.error('TRANSITION_INVALID', 'Transition non autorisée', 'DEMANDE', id);
```

---

## 🔧 CONFIGURATION

### Variables d'environnement

```env
# Niveau de log (debug, info, warn, error)
LOG_LEVEL=info

# Environnement (active pino-pretty en dev)
NODE_ENV=production
```

### Production vs Développement

| Mode | Format | Pretty Print |
|------|--------|--------------|
| **Development** | JSON + Pretty | ✅ Coloré |
| **Production** | JSON brut | ❌ Non |

---

## 📡 INTÉGRATION OUTILS

### ELK Stack / Elasticsearch
Les logs JSON sont directement indexables dans Elasticsearch.

### Datadog / CloudWatch
Format JSON compatible avec les agents de collecte standard.

### Filtrage par correlationId
```bash
# Trouver tous les logs d'une requête spécifique
grep "abc-123-def" /var/log/manchengo/*.log
```

---

## 🔍 DIAGNOSTIC INCIDENT (3h du matin)

### Étapes de diagnostic

1. **Récupérer le correlationId** depuis l'erreur client ou l'alerte
2. **Filtrer les logs** par ce correlationId
3. **Suivre la chronologie** des actions métier
4. **Identifier le point d'échec** (ERROR log)
5. **Analyser le contexte** (userId, entityType, entityId)

### Exemple de trace complète
```
14:30:00.100 INFO  [ApproService] DEMANDE_CREATED entityType=DEMANDE entityId=123 correlationId=abc-123
14:30:00.250 INFO  [ApproService] DEMANDE_VALIDATED entityType=DEMANDE entityId=123 correlationId=abc-123
14:30:00.400 INFO  [ApproService] BC_GENERATED entityType=PURCHASE_ORDER entityId=PO-001 correlationId=abc-123
14:30:00.600 ERROR [ApproService] BC_SEND_FAILED error="SMTP timeout" entityType=PURCHASE_ORDER entityId=PO-001 correlationId=abc-123
```

---

## ✅ CHECKLIST GO PROD

- [ ] Tous les `console.log` remplacés par `logger.info()`
- [ ] Tous les `console.warn` remplacés par `logger.warn()`
- [ ] Tous les `console.error` remplacés par `logger.error()`
- [ ] Actions métier critiques loggées avec `businessInfo()`
- [ ] CorrelationId injecté dans chaque requête
- [ ] Aucune donnée sensible dans les logs
- [ ] LOG_LEVEL=info en production
- [ ] Tests de diagnostic effectués

---

**Document maintenu par:** Équipe Backend Manchengo  
**Dernière mise à jour:** Janvier 2026
