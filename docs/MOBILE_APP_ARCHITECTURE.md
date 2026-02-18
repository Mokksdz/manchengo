# Application Mobile Manchengo ERP - Architecture

## Vue d'ensemble

Application mobile dédiée pour les opérateurs terrain (production, livraison, inventaire) avec support offline-first.

## Stack Technologique Recommandée

### Option 1: React Native (Recommandé)
- **Framework**: React Native + Expo
- **State**: Zustand + React Query
- **Storage**: MMKV / AsyncStorage
- **Navigation**: React Navigation v6
- **UI**: NativeWind (Tailwind for RN)

### Option 2: Flutter
- **Framework**: Flutter 3.x
- **State**: Riverpod
- **Storage**: Hive / Isar
- **UI**: Material 3

## Architecture

```
manchengo-mobile/
├── src/
│   ├── app/                    # Entry point & providers
│   ├── features/               # Feature modules
│   │   ├── auth/               # Authentication
│   │   ├── production/         # Production management
│   │   ├── delivery/           # Delivery & QR scanning
│   │   ├── inventory/          # Stock inventory
│   │   └── sync/               # Offline sync
│   ├── shared/
│   │   ├── components/         # Reusable UI
│   │   ├── hooks/              # Custom hooks
│   │   ├── services/           # API & storage
│   │   └── utils/              # Helpers
│   └── navigation/             # Route configuration
├── assets/                     # Images, fonts
└── __tests__/                  # Test files
```

## Fonctionnalités par Module

### 1. Authentication
- Login avec JWT (même backend que web)
- Biometric authentication (Face ID / Fingerprint)
- Session persistence avec refresh token
- Device registration

### 2. Production (Opérateur)
- Liste des ordres de production assignés
- Démarrer/Terminer une production
- Saisie des quantités produites
- Scan QR des lots MP
- Notes qualité et photos

### 3. Livraison (Livreur)
- Liste des BL à livrer
- Navigation GPS vers client
- Scan QR du bon de livraison
- Capture signature client
- Photo preuve de livraison
- Confirmation avec sync backend

### 4. Inventaire (Magasinier)
- Scan QR des lots
- Comptage physique
- Écarts automatiques
- Validation superviseur

### 5. Sync Offline-First
```typescript
// Sync strategy
interface SyncStrategy {
  // Queue des mutations offline
  offlineQueue: MutationQueue;

  // Dernier état synchronisé
  lastSyncTimestamp: number;

  // Conflits à résoudre
  conflicts: ConflictItem[];
}

// Mutation queue
interface QueuedMutation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: string;
  payload: any;
  timestamp: number;
  retryCount: number;
}
```

## API Sync Protocol

### Push (Mobile → Server)
```
POST /api/sync/push
Authorization: Bearer {token}
X-Device-Id: {device-id}
X-Client-Timestamp: {timestamp}

{
  "events": [
    {
      "id": "uuid",
      "type": "PRODUCTION_COMPLETED",
      "payload": { ... },
      "occurredAt": "2024-01-15T10:30:00Z"
    }
  ],
  "lastSyncAt": "2024-01-15T10:00:00Z"
}
```

### Pull (Server → Mobile)
```
GET /api/sync/pull?since={timestamp}
Authorization: Bearer {token}
X-Device-Id: {device-id}

Response:
{
  "events": [...],
  "serverTime": "2024-01-15T10:31:00Z",
  "hasMore": false
}
```

## Notifications Push

### Configuration Firebase Cloud Messaging (FCM)
```typescript
// Types de notifications
type NotificationType =
  | 'NEW_PRODUCTION_ORDER'    // Nouvel ordre assigné
  | 'DELIVERY_ASSIGNED'       // Nouvelle livraison
  | 'LOW_STOCK_ALERT'         // Alerte stock
  | 'SYNC_REQUIRED'           // Sync nécessaire
  | 'ORDER_UPDATED';          // Mise à jour ordre
```

## Sécurité Mobile

### 1. Stockage sécurisé
- Tokens dans Keychain (iOS) / Keystore (Android)
- Données sensibles chiffrées

### 2. Certificate Pinning
```typescript
// SSL Pinning configuration
const sslPins = {
  'api.manchengo.dz': [
    'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
  ]
};
```

### 3. Jailbreak/Root Detection
- Vérification au démarrage
- Désactivation fonctionnalités sensibles

## UI/UX Mobile

### Design System
- Couleurs: Même palette que web (#F5A623 primaire)
- Typography: Inter (comme web)
- Icons: Lucide React Native
- Animations: Reanimated 3

### Composants clés
```typescript
// Bottom Sheet pour actions
<BottomSheet>
  <ProductionActions orderId={id} />
</BottomSheet>

// Scanner QR
<QRScanner
  onScan={handleScan}
  overlay={<ScanOverlay />}
/>

// Pull to refresh
<RefreshControl
  refreshing={isRefreshing}
  onRefresh={handleRefresh}
/>
```

## Tests

### Unit Tests
- Jest + React Native Testing Library
- Coverage minimum: 70%

### E2E Tests
- Detox (React Native)
- Appium (cross-platform)

## Build & Deploy

### iOS
```bash
# Development
eas build --platform ios --profile development

# Production
eas build --platform ios --profile production
eas submit --platform ios
```

### Android
```bash
# Development
eas build --platform android --profile development

# Production
eas build --platform android --profile production
eas submit --platform android
```

## Roadmap

### Phase 1 (MVP) - 4 semaines
- [ ] Auth + Device registration
- [ ] Production view (read-only)
- [ ] Basic offline storage

### Phase 2 - 4 semaines
- [ ] Production actions (start/complete)
- [ ] QR scanning
- [ ] Push notifications

### Phase 3 - 4 semaines
- [ ] Delivery module
- [ ] Signature capture
- [ ] GPS navigation

### Phase 4 - 2 semaines
- [ ] Inventory module
- [ ] Advanced sync
- [ ] Analytics

## Estimation

| Phase | Durée | Effort |
|-------|-------|--------|
| Phase 1 | 4 sem | 160h |
| Phase 2 | 4 sem | 160h |
| Phase 3 | 4 sem | 160h |
| Phase 4 | 2 sem | 80h |
| **Total** | **14 sem** | **560h** |

---

*Document créé le 3 février 2026*
