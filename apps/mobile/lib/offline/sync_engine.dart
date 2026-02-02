import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:uuid/uuid.dart';
import 'database.dart';
import 'sync_queue.dart';
import 'retry_manager.dart';
import 'audit_service.dart';
import 'auth_offline.dart';

/// Push response from server
class PushResponse {
  final bool success;
  final String batchId;
  final List<String> ackedEventIds;
  final Map<String, String> serverEventIds;
  final List<FailedEvent> failedEvents;
  final DateTime serverTime;
  final List<String> warnings;

  PushResponse({
    required this.success,
    required this.batchId,
    required this.ackedEventIds,
    required this.serverEventIds,
    required this.failedEvents,
    required this.serverTime,
    required this.warnings,
  });

  factory PushResponse.fromJson(Map<String, dynamic> json) {
    return PushResponse(
      success: json['success'] as bool,
      batchId: json['batchId'] as String,
      ackedEventIds: List<String>.from(json['ackedEventIds'] ?? []),
      serverEventIds: Map<String, String>.from(json['serverEventIds'] ?? {}),
      failedEvents: (json['failedEvents'] as List?)
              ?.map((e) => FailedEvent.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      serverTime: DateTime.parse(json['serverTime'] as String),
      warnings: List<String>.from(json['warnings'] ?? []),
    );
  }
}

/// Failed event from server response
class FailedEvent {
  final String eventId;
  final String errorCode;
  final String errorMessage;
  final bool retry;
  final Map<String, dynamic>? resolution;

  FailedEvent({
    required this.eventId,
    required this.errorCode,
    required this.errorMessage,
    required this.retry,
    this.resolution,
  });

  factory FailedEvent.fromJson(Map<String, dynamic> json) {
    return FailedEvent(
      eventId: json['eventId'] as String,
      errorCode: json['errorCode'] as String,
      errorMessage: json['errorMessage'] as String,
      retry: json['retry'] as bool? ?? false,
      resolution: json['resolution'] as Map<String, dynamic>?,
    );
  }
}

/// Pull response from server
class PullResponse {
  final List<ServerEvent> events;
  final bool hasMore;
  final String? nextCursor;
  final DateTime serverTime;
  final List<CacheInvalidation> cacheInvalidations;
  final DeviceStatus deviceStatus;

  PullResponse({
    required this.events,
    required this.hasMore,
    this.nextCursor,
    required this.serverTime,
    required this.cacheInvalidations,
    required this.deviceStatus,
  });

  factory PullResponse.fromJson(Map<String, dynamic> json) {
    return PullResponse(
      events: (json['events'] as List?)
              ?.map((e) => ServerEvent.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      hasMore: json['hasMore'] as bool? ?? false,
      nextCursor: json['nextCursor'] as String?,
      serverTime: DateTime.parse(json['serverTime'] as String),
      cacheInvalidations: (json['cacheInvalidations'] as List?)
              ?.map((e) => CacheInvalidation.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      deviceStatus: DeviceStatus.fromJson(
          json['deviceStatus'] as Map<String, dynamic>? ?? {}),
    );
  }
}

/// Server event from pull response
class ServerEvent {
  final String id;
  final String entityType;
  final String entityId;
  final String action;
  final Map<String, dynamic> payload;
  final DateTime occurredAt;
  final String userId;
  final String? sourceDeviceId;

  ServerEvent({
    required this.id,
    required this.entityType,
    required this.entityId,
    required this.action,
    required this.payload,
    required this.occurredAt,
    required this.userId,
    this.sourceDeviceId,
  });

  factory ServerEvent.fromJson(Map<String, dynamic> json) {
    return ServerEvent(
      id: json['id'] as String,
      entityType: json['entityType'] as String,
      entityId: json['entityId'] as String,
      action: json['action'] as String,
      payload: json['payload'] as Map<String, dynamic>? ?? {},
      occurredAt: DateTime.parse(json['occurredAt'] as String),
      userId: json['userId'] as String,
      sourceDeviceId: json['sourceDeviceId'] as String?,
    );
  }
}

/// Cache invalidation instruction from server
class CacheInvalidation {
  final String entityType;
  final List<String> entityIds;
  final String reason;

  CacheInvalidation({
    required this.entityType,
    required this.entityIds,
    required this.reason,
  });

  factory CacheInvalidation.fromJson(Map<String, dynamic> json) {
    return CacheInvalidation(
      entityType: json['entityType'] as String,
      entityIds: List<String>.from(json['entityIds'] ?? []),
      reason: json['reason'] as String? ?? '',
    );
  }
}

/// Device status from server
class DeviceStatus {
  final bool isActive;
  final bool requiresReauth;
  final String? message;

  DeviceStatus({
    required this.isActive,
    required this.requiresReauth,
    this.message,
  });

  factory DeviceStatus.fromJson(Map<String, dynamic> json) {
    return DeviceStatus(
      isActive: json['isActive'] as bool? ?? true,
      requiresReauth: json['requiresReauth'] as bool? ?? false,
      message: json['message'] as String?,
    );
  }
}

/// Sync engine state
enum SyncState {
  idle,
  pushing,
  pulling,
  error,
}

/// Main sync engine for offline-first architecture
class SyncEngine {
  final OfflineDatabase _db;
  final SyncQueue _queue;
  final RetryManager _retryManager;
  final AuditService _auditService;
  final AuthOffline _authOffline;

  final String _baseUrl;
  final Uuid _uuid = const Uuid();

  static const int _maxBatchSize = 50;
  static const Duration _syncInterval = Duration(minutes: 5);
  static const Duration _pushTimeout = Duration(seconds: 30);
  static const Duration _pullTimeout = Duration(seconds: 30);

  Timer? _syncTimer;
  SyncState _state = SyncState.idle;
  final StreamController<SyncState> _stateController =
      StreamController<SyncState>.broadcast();

  SyncEngine({
    required OfflineDatabase db,
    required SyncQueue queue,
    required RetryManager retryManager,
    required AuditService auditService,
    required AuthOffline authOffline,
    required String baseUrl,
  })  : _db = db,
        _queue = queue,
        _retryManager = retryManager,
        _auditService = auditService,
        _authOffline = authOffline,
        _baseUrl = baseUrl;

  Stream<SyncState> get stateStream => _stateController.stream;
  SyncState get state => _state;

  void _setState(SyncState newState) {
    _state = newState;
    _stateController.add(newState);
  }

  /// Start automatic sync
  void startAutoSync() {
    _syncTimer?.cancel();
    _syncTimer = Timer.periodic(_syncInterval, (_) => sync());
    
    // Initial sync
    sync();
  }

  /// Stop automatic sync
  void stopAutoSync() {
    _syncTimer?.cancel();
    _syncTimer = null;
  }

  /// Perform full sync (push then pull)
  Future<void> sync() async {
    if (_state != SyncState.idle) {
      return; // Already syncing
    }

    // Check auth status
    final authStatus = await _authOffline.getAuthStatus();
    if (authStatus != AuthStatus.authenticated) {
      _auditService.log(
        action: 'SYNC_SKIPPED',
        entityType: 'SYNC',
        entityId: 'N/A',
        context: {'reason': 'Auth status: $authStatus'},
      );
      return;
    }

    try {
      // Push first
      await pushBatch();

      // Then pull
      await pullUpdates();
    } catch (e) {
      _setState(SyncState.error);
      _auditService.log(
        action: 'SYNC_ERROR',
        entityType: 'SYNC',
        entityId: 'N/A',
        context: {'error': e.toString()},
      );
    } finally {
      _setState(SyncState.idle);
    }
  }

  /// Push pending events to server
  Future<PushResponse?> pushBatch() async {
    _setState(SyncState.pushing);

    // Reset any events stuck in SENDING state (crash recovery)
    await _queue.resetSendingToPending();

    final events = await _queue.getPendingEvents(limit: _maxBatchSize);
    if (events.isEmpty) {
      return null;
    }

    final deviceId = await _db.getDeviceId();
    final accessToken = await _authOffline.getAccessToken();

    if (deviceId == null || accessToken == null) {
      throw Exception('Device not registered or not authenticated');
    }

    final batchId = _uuid.v4();
    final eventIds = events.map((e) => e.id).toList();

    // Mark events as sending
    await _queue.markAsSending(eventIds, batchId);

    try {
      final response = await http
          .post(
            Uri.parse('$_baseUrl/api/sync/push'),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $accessToken',
              'X-Device-Id': deviceId,
            },
            body: jsonEncode({
              'deviceId': deviceId,
              'batchId': batchId,
              'events': events.map((e) => e.toApiPayload()).toList(),
            }),
          )
          .timeout(_pushTimeout);

      if (response.statusCode == 200) {
        final pushResponse = PushResponse.fromJson(
          jsonDecode(response.body) as Map<String, dynamic>,
        );

        // Mark acked events
        await _queue.markAsAcked(pushResponse.ackedEventIds);

        // Handle failed events
        for (final failed in pushResponse.failedEvents) {
          if (failed.retry) {
            await _queue.markAsFailed(failed.eventId, failed.errorMessage);
          } else {
            await _queue.markAsFailed(
              failed.eventId,
              failed.errorMessage,
              incrementRetry: false,
            );
            await _handleConflictResolution(failed);
          }
        }

        // Update server time offset
        final offset = pushResponse.serverTime.difference(DateTime.now());
        await _db.setMeta('server_time_offset', offset.inMilliseconds.toString());

        // Update last push time
        await _db.setLastPushAt(DateTime.now());

        // Audit log
        await _auditService.log(
          action: 'SYNC_PUSH_SUCCESS',
          entityType: 'SYNC',
          entityId: batchId,
          context: {
            'eventCount': events.length,
            'ackedCount': pushResponse.ackedEventIds.length,
            'failedCount': pushResponse.failedEvents.length,
          },
        );

        return pushResponse;
      } else if (response.statusCode == 401) {
        // Token expired - trigger reauth
        await _authOffline.handleTokenExpired();
        throw Exception('Authentication required');
      } else if (response.statusCode == 403) {
        // Device revoked
        await _authOffline.handleDeviceRevoked();
        throw Exception('Device revoked');
      } else {
        throw Exception('Push failed: ${response.statusCode}');
      }
    } catch (e) {
      // Reset events to pending for retry
      await _retryManager.handlePushFailure(eventIds, e.toString());
      rethrow;
    }
  }

  /// Pull updates from server
  Future<PullResponse?> pullUpdates() async {
    _setState(SyncState.pulling);

    final deviceId = await _db.getDeviceId();
    final accessToken = await _authOffline.getAccessToken();
    final lastPullAt = await _db.getLastPullAt();

    if (deviceId == null || accessToken == null) {
      throw Exception('Device not registered or not authenticated');
    }

    final since = lastPullAt?.toUtc().toIso8601String() ?? '1970-01-01T00:00:00Z';

    try {
      final response = await http
          .get(
            Uri.parse('$_baseUrl/api/sync/pull?deviceId=$deviceId&since=$since'),
            headers: {
              'Authorization': 'Bearer $accessToken',
              'X-Device-Id': deviceId,
            },
          )
          .timeout(_pullTimeout);

      if (response.statusCode == 200) {
        final pullResponse = PullResponse.fromJson(
          jsonDecode(response.body) as Map<String, dynamic>,
        );

        // Check device status
        if (!pullResponse.deviceStatus.isActive) {
          await _authOffline.handleDeviceRevoked();
          throw Exception('Device revoked');
        }

        if (pullResponse.deviceStatus.requiresReauth) {
          await _authOffline.handleTokenExpired();
          throw Exception('Re-authentication required');
        }

        // Apply server events to local cache
        await _applyServerEvents(pullResponse.events);

        // Handle cache invalidations
        await _handleCacheInvalidations(pullResponse.cacheInvalidations);

        // Update last pull time
        await _db.setLastPullAt(pullResponse.serverTime);

        // If more events, continue pulling
        if (pullResponse.hasMore && pullResponse.nextCursor != null) {
          await _pullWithCursor(pullResponse.nextCursor!);
        }

        // Audit log
        await _auditService.log(
          action: 'SYNC_PULL_SUCCESS',
          entityType: 'SYNC',
          entityId: 'PULL',
          context: {
            'eventCount': pullResponse.events.length,
            'hasMore': pullResponse.hasMore,
          },
        );

        return pullResponse;
      } else if (response.statusCode == 401) {
        await _authOffline.handleTokenExpired();
        throw Exception('Authentication required');
      } else if (response.statusCode == 403) {
        await _authOffline.handleDeviceRevoked();
        throw Exception('Device revoked');
      } else {
        throw Exception('Pull failed: ${response.statusCode}');
      }
    } catch (e) {
      await _auditService.log(
        action: 'SYNC_PULL_ERROR',
        entityType: 'SYNC',
        entityId: 'PULL',
        context: {'error': e.toString()},
      );
      rethrow;
    }
  }

  /// Continue pulling with cursor
  Future<void> _pullWithCursor(String cursor) async {
    final deviceId = await _db.getDeviceId();
    final accessToken = await _authOffline.getAccessToken();
    final lastPullAt = await _db.getLastPullAt();
    final since = lastPullAt?.toUtc().toIso8601String() ?? '1970-01-01T00:00:00Z';

    final response = await http
        .get(
          Uri.parse(
              '$_baseUrl/api/sync/pull?deviceId=$deviceId&since=$since&cursor=$cursor'),
          headers: {
            'Authorization': 'Bearer $accessToken',
            'X-Device-Id': deviceId!,
          },
        )
        .timeout(_pullTimeout);

    if (response.statusCode == 200) {
      final pullResponse = PullResponse.fromJson(
        jsonDecode(response.body) as Map<String, dynamic>,
      );

      await _applyServerEvents(pullResponse.events);
      await _handleCacheInvalidations(pullResponse.cacheInvalidations);

      if (pullResponse.hasMore && pullResponse.nextCursor != null) {
        await _pullWithCursor(pullResponse.nextCursor!);
      }

      await _db.setLastPullAt(pullResponse.serverTime);
    }
  }

  /// Apply server events to local database
  Future<void> _applyServerEvents(List<ServerEvent> events) async {
    final db = await _db.database;

    await db.transaction((txn) async {
      for (final event in events) {
        switch (event.entityType.toUpperCase()) {
          case 'DELIVERY':
            await _applyDeliveryEvent(txn, event);
            break;
          case 'INVOICE':
            await _applyInvoiceEvent(txn, event);
            break;
          case 'PRODUCT_PF':
            await _applyProductEvent(txn, event);
            break;
          case 'CLIENT':
            await _applyClientEvent(txn, event);
            break;
          case 'STOCK_PF':
            await _applyStockEvent(txn, event);
            break;
        }
      }
    });
  }

  Future<void> _applyDeliveryEvent(dynamic txn, ServerEvent event) async {
    if (event.action == 'DELIVERY_CREATED') {
      await txn.insert('cache_deliveries_pending', {
        'id': event.entityId,
        'reference': event.payload['reference'],
        'invoice_id': event.payload['invoice_id'],
        'invoice_ref': event.payload['invoice_ref'],
        'client_id': event.payload['client_id'],
        'client_name': event.payload['client_name'],
        'client_address': event.payload['client_address'],
        'total_ttc': event.payload['total_ttc'],
        'scheduled_date': event.payload['scheduled_date'],
        'qr_code': event.payload['qr_code'],
        'status': 'PENDING',
        'updated_at': event.occurredAt.toIso8601String(),
      });
    } else if (event.action == 'DELIVERY_VALIDATED' ||
        event.action == 'DELIVERY_CANCELLED') {
      await txn.delete(
        'cache_deliveries_pending',
        where: 'id = ?',
        whereArgs: [event.entityId],
      );
    }
  }

  Future<void> _applyInvoiceEvent(dynamic txn, ServerEvent event) async {
    // Update local draft if exists
    if (event.action == 'INVOICE_CREATED') {
      final tempId = event.payload['temp_id'];
      if (tempId != null) {
        await txn.update(
          'draft_invoices',
          {
            'status': 'SYNCED',
            'server_invoice_id': event.payload['id'],
            'server_reference': event.payload['reference'],
          },
          where: 'id = ?',
          whereArgs: [tempId],
        );
      }
    }
  }

  Future<void> _applyProductEvent(dynamic txn, ServerEvent event) async {
    await txn.insert(
      'cache_products_pf',
      {
        'id': event.payload['id'],
        'code': event.payload['code'],
        'name': event.payload['name'],
        'short_name': event.payload['short_name'],
        'unit': event.payload['unit'],
        'price_ht': event.payload['price_ht'],
        'min_stock': event.payload['min_stock'],
        'is_active': event.payload['is_active'] == true ? 1 : 0,
        'updated_at': event.occurredAt.toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<void> _applyClientEvent(dynamic txn, ServerEvent event) async {
    await txn.insert(
      'cache_clients',
      {
        'id': event.payload['id'],
        'code': event.payload['code'],
        'name': event.payload['name'],
        'type': event.payload['type'],
        'phone': event.payload['phone'],
        'address': event.payload['address'],
        'nif': event.payload['nif'],
        'rc': event.payload['rc'],
        'updated_at': event.occurredAt.toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<void> _applyStockEvent(dynamic txn, ServerEvent event) async {
    await txn.insert(
      'cache_stock_pf',
      {
        'product_id': event.payload['product_id'],
        'product_code': event.payload['product_code'],
        'product_name': event.payload['product_name'],
        'current_stock': event.payload['current_stock'],
        'min_stock': event.payload['min_stock'],
        'unit': event.payload['unit'],
        'status': event.payload['status'],
        'updated_at': event.occurredAt.toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  /// Handle cache invalidations
  Future<void> _handleCacheInvalidations(
      List<CacheInvalidation> invalidations) async {
    final db = await _db.database;

    for (final inv in invalidations) {
      final tableName = _getTableForEntityType(inv.entityType);
      if (tableName == null) continue;

      if (inv.entityIds.contains('*')) {
        // Invalidate all
        await db.delete(tableName);
      } else {
        // Invalidate specific IDs
        final placeholders = List.filled(inv.entityIds.length, '?').join(',');
        await db.delete(
          tableName,
          where: 'id IN ($placeholders)',
          whereArgs: inv.entityIds,
        );
      }
    }
  }

  String? _getTableForEntityType(String entityType) {
    switch (entityType.toUpperCase()) {
      case 'PRODUCT_PF':
        return 'cache_products_pf';
      case 'CLIENT':
        return 'cache_clients';
      case 'DELIVERY':
        return 'cache_deliveries_pending';
      case 'STOCK_PF':
        return 'cache_stock_pf';
      default:
        return null;
    }
  }

  /// Handle conflict resolution from server
  Future<void> _handleConflictResolution(FailedEvent failed) async {
    final action = failed.resolution?['action'] as String?;

    switch (action) {
      case 'DISCARD_LOCAL':
        // Remove local pending data
        await _discardLocalData(failed);
        break;
      case 'MERGE':
        // Attempt to merge data
        break;
      case 'MANUAL':
        // Flag for manual review
        await _auditService.log(
          action: 'CONFLICT_MANUAL_REQUIRED',
          entityType: 'SYNC',
          entityId: failed.eventId,
          context: {
            'errorCode': failed.errorCode,
            'resolution': failed.resolution,
          },
        );
        break;
    }
  }

  Future<void> _discardLocalData(FailedEvent failed) async {
    final db = await _db.database;

    // Get the original event to know what to discard
    final event = await _queue.getEvent(failed.eventId);
    if (event == null) return;

    switch (event.entityType) {
      case SyncEntityType.delivery:
        await db.delete(
          'pending_delivery_validations',
          where: 'delivery_id = ?',
          whereArgs: [event.entityId],
        );
        break;
      case SyncEntityType.invoice:
        await db.delete(
          'draft_invoices',
          where: 'id = ?',
          whereArgs: [event.entityId],
        );
        break;
      case SyncEntityType.payment:
        await db.delete(
          'pending_payments',
          where: 'id = ?',
          whereArgs: [event.entityId],
        );
        break;
      default:
        break;
    }
  }

  /// Dispose resources
  void dispose() {
    stopAutoSync();
    _stateController.close();
  }
}
