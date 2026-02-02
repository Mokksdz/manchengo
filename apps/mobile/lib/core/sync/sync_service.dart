import 'package:flutter/foundation.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'sync_config.dart';
import 'sync_client.dart';
import 'sync_event_service.dart';
import 'device_identity.dart';
import 'pull_client.dart';
import 'event_applier.dart';
import 'sync_state.dart';

/// Sync status
enum SyncStatus {
  idle,
  syncing,
  success,
  partialSuccess,
  error,
  offline,
}

/// Sync result summary
class SyncResult {
  final SyncStatus status;
  final int syncedCount;
  final int pendingCount;
  final String? errorMessage;

  const SyncResult({
    required this.status,
    this.syncedCount = 0,
    this.pendingCount = 0,
    this.errorMessage,
  });

  bool get isSuccess => status == SyncStatus.success;
}

/// Service for bidirectional sync (push + pull)
/// 
/// Responsibilities:
/// - Push: Send local events to server
/// - Pull: Receive server events and apply locally
/// - Handle errors with retry strategy
class SyncService {
  static final SyncService _instance = SyncService._();
  factory SyncService() => _instance;
  SyncService._();

  final SyncClient _pushClient = SyncClient();
  final PullClient _pullClient = PullClient();
  final SyncEventService _eventService = SyncEventService();
  final EventApplier _applier = EventApplier();
  
  bool _isSyncing = false;
  bool _isPulling = false;
  int _retryCount = 0;

  /// Check if currently syncing
  bool get isSyncing => _isSyncing || _isPulling;

  /// Push all pending events to server
  /// 
  /// Returns sync result with status and counts.
  /// Idempotent: safe to call multiple times.
  Future<SyncResult> pushSync() async {
    // Prevent concurrent syncs
    if (_isSyncing) {
      debugPrint('Sync: Already syncing, skipping');
      return const SyncResult(status: SyncStatus.syncing);
    }

    // Check connectivity
    final connectivity = await Connectivity().checkConnectivity();
    if (connectivity == ConnectivityResult.none) {
      debugPrint('Sync: No connectivity');
      return const SyncResult(status: SyncStatus.offline);
    }

    _isSyncing = true;
    int totalSynced = 0;

    try {
      final deviceId = await DeviceIdentity.getDeviceId();

      while (true) {
        // Fetch pending events (batch)
        final pending = await _eventService.getPendingEvents(
          limit: SyncConfig.batchSize,
        );

        if (pending.isEmpty) {
          debugPrint('Sync: No pending events');
          break;
        }

        debugPrint('Sync: Processing batch of ${pending.length} events');

        // Push batch to server
        final result = await _client.pushEvents(
          deviceId: deviceId,
          events: pending,
        );

        // Handle error
        if (result.hasError) {
          final error = result.error!;
          debugPrint('Sync: Error - ${error.message}');

          // Mark acked events even on partial failure
          if (result.ackedEventIds.isNotEmpty) {
            await _eventService.markEventsSynced(result.ackedEventIds);
            totalSynced += result.ackedEventIds.length;
          }

          // Should retry?
          if (error.shouldRetry && _retryCount < SyncConfig.maxRetries) {
            _retryCount++;
            final delay = SyncConfig.retryDelays[
              _retryCount.clamp(0, SyncConfig.retryDelays.length - 1)
            ];
            debugPrint('Sync: Will retry in ${delay.inSeconds}s (attempt $_retryCount)');
            
            // Don't block, return partial result
            _isSyncing = false;
            final pendingCount = await _eventService.getPendingCount();
            return SyncResult(
              status: SyncStatus.partialSuccess,
              syncedCount: totalSynced,
              pendingCount: pendingCount,
              errorMessage: error.message,
            );
          }

          // Fatal error or max retries
          _isSyncing = false;
          final pendingCount = await _eventService.getPendingCount();
          return SyncResult(
            status: SyncStatus.error,
            syncedCount: totalSynced,
            pendingCount: pendingCount,
            errorMessage: error.message,
          );
        }

        // Mark acked events as synced
        if (result.ackedEventIds.isNotEmpty) {
          await _eventService.markEventsSynced(result.ackedEventIds);
          totalSynced += result.ackedEventIds.length;
        }

        // Reset retry count on success
        _retryCount = 0;

        // If we got less than batch size, we're done
        if (pending.length < SyncConfig.batchSize) {
          break;
        }
      }

      _isSyncing = false;
      final pendingCount = await _eventService.getPendingCount();

      if (pendingCount == 0) {
        debugPrint('Sync: Complete - $totalSynced events synced');
        return SyncResult(
          status: SyncStatus.success,
          syncedCount: totalSynced,
          pendingCount: 0,
        );
      } else {
        debugPrint('Sync: Partial - $totalSynced synced, $pendingCount pending');
        return SyncResult(
          status: SyncStatus.partialSuccess,
          syncedCount: totalSynced,
          pendingCount: pendingCount,
        );
      }
    } catch (e) {
      debugPrint('Sync: Unexpected error - $e');
      _isSyncing = false;
      final pendingCount = await _eventService.getPendingCount();
      return SyncResult(
        status: SyncStatus.error,
        syncedCount: totalSynced,
        pendingCount: pendingCount,
        errorMessage: 'Erreur inattendue: $e',
      );
    }
  }

  /// Get current pending count
  Future<int> getPendingCount() async {
    return await _eventService.getPendingCount();
  }

  /// Reset retry counter (call after manual retry)
  void resetRetry() {
    _retryCount = 0;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // PULL SYNC
  // ────────────────────────────────────────────────────────────────────────────

  /// Pull events from server and apply locally
  /// 
  /// Fetches events since last sync, applies them to SQLite.
  /// Conflict resolution: server-wins for critical entities, LWW for others.
  Future<SyncResult> pullSync() async {
    if (_isPulling) {
      debugPrint('Pull: Already pulling, skipping');
      return const SyncResult(status: SyncStatus.syncing);
    }

    // Check connectivity
    final connectivity = await Connectivity().checkConnectivity();
    if (connectivity == ConnectivityResult.none) {
      debugPrint('Pull: No connectivity');
      return const SyncResult(status: SyncStatus.offline);
    }

    _isPulling = true;
    int appliedCount = 0;

    try {
      final deviceId = await DeviceIdentity.getDeviceId();
      final lastPullAt = await SyncState.getLastPullAt();

      debugPrint('Pull: Fetching events since ${lastPullAt?.toIso8601String() ?? 'beginning'}');

      // Fetch events from server
      final result = await _pullClient.pullEvents(
        deviceId: deviceId,
        since: lastPullAt,
      );

      if (result.hasError) {
        debugPrint('Pull: Error - ${result.error!.message}');
        _isPulling = false;
        return SyncResult(
          status: SyncStatus.error,
          errorMessage: result.error!.message,
        );
      }

      final response = result.response!;
      debugPrint('Pull: Received ${response.events.length} events');

      // Apply each event
      for (final event in response.events) {
        final applied = await _applier.applyEvent(event);
        if (applied) {
          appliedCount++;
        }
      }

      // Update sync state
      await SyncState.setLastPullAt(response.serverTime);
      await SyncState.setLastServerTime(response.serverTime);
      await SyncState.setLastSuccessfulSync(DateTime.now().toUtc());

      _isPulling = false;
      debugPrint('Pull: Complete - $appliedCount events applied');

      return SyncResult(
        status: SyncStatus.success,
        syncedCount: appliedCount,
        pendingCount: 0,
      );
    } catch (e) {
      debugPrint('Pull: Unexpected error - $e');
      _isPulling = false;
      return SyncResult(
        status: SyncStatus.error,
        syncedCount: appliedCount,
        errorMessage: 'Erreur inattendue: $e',
      );
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // FULL SYNC
  // ────────────────────────────────────────────────────────────────────────────

  /// Full bidirectional sync: push then pull
  /// 
  /// Ensures local changes are sent before receiving remote changes.
  Future<SyncResult> syncAll() async {
    debugPrint('Sync: Starting full sync (push + pull)');

    // Step 1: Push local events
    final pushResult = await pushSync();
    if (pushResult.status == SyncStatus.error) {
      debugPrint('Sync: Push failed, aborting full sync');
      return pushResult;
    }

    // Step 2: Pull remote events
    final pullResult = await pullSync();
    
    // Combine results
    final totalSynced = pushResult.syncedCount + pullResult.syncedCount;
    final finalStatus = pullResult.status == SyncStatus.success && 
                        (pushResult.status == SyncStatus.success || pushResult.status == SyncStatus.partialSuccess)
        ? SyncStatus.success
        : pullResult.status;

    debugPrint('Sync: Full sync complete - $totalSynced total events');

    return SyncResult(
      status: finalStatus,
      syncedCount: totalSynced,
      pendingCount: pushResult.pendingCount,
      errorMessage: pullResult.errorMessage ?? pushResult.errorMessage,
    );
  }

  /// Get last successful sync time
  Future<DateTime?> getLastSyncTime() async {
    return await SyncState.getLastSuccessfulSync();
  }
}
