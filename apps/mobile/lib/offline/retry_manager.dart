import 'dart:async';
import 'dart:math';
import 'database.dart';
import 'sync_queue.dart';

/// Retry configuration
class RetryConfig {
  final int maxRetries;
  final Duration baseDelay;
  final Duration maxDelay;
  final double backoffMultiplier;

  const RetryConfig({
    this.maxRetries = 5,
    this.baseDelay = const Duration(seconds: 1),
    this.maxDelay = const Duration(minutes: 5),
    this.backoffMultiplier = 2.0,
  });

  /// Calculate delay for given retry count using exponential backoff
  Duration getDelay(int retryCount) {
    if (retryCount <= 0) return baseDelay;

    final exponentialDelay = baseDelay.inMilliseconds *
        pow(backoffMultiplier, retryCount - 1).toInt();

    final cappedDelay = min(exponentialDelay, maxDelay.inMilliseconds);

    // Add jitter (±10%) to prevent thundering herd
    final jitter = (Random().nextDouble() * 0.2 - 0.1) * cappedDelay;

    return Duration(milliseconds: (cappedDelay + jitter).toInt());
  }
}

/// Manages retry logic for failed sync operations
class RetryManager {
  final OfflineDatabase _db;
  final SyncQueue _queue;
  final RetryConfig _config;

  Timer? _retryTimer;
  bool _isRetrying = false;

  RetryManager({
    required OfflineDatabase db,
    required SyncQueue queue,
    RetryConfig? config,
  })  : _db = db,
        _queue = queue,
        _config = config ?? const RetryConfig();

  /// Handle push failure for a batch of events
  Future<void> handlePushFailure(List<String> eventIds, String error) async {
    final db = await _db.database;

    for (final eventId in eventIds) {
      final event = await _queue.getEvent(eventId);
      if (event == null) continue;

      if (event.retryCount >= _config.maxRetries) {
        // Max retries exceeded - mark as permanently failed
        await _queue.markAsFailed(
          eventId,
          'Max retries exceeded: $error',
          incrementRetry: false,
        );
      } else {
        // Reset to pending with incremented retry count
        await db.rawUpdate(
          '''
          UPDATE sync_queue 
          SET status = 'PENDING', 
              last_error = ?,
              retry_count = retry_count + 1
          WHERE id = ?
          ''',
          [error, eventId],
        );
      }
    }

    // Schedule retry
    _scheduleRetry();
  }

  /// Schedule a retry attempt
  void _scheduleRetry() {
    if (_isRetrying) return;

    _retryTimer?.cancel();

    // Get minimum retry count among pending events to calculate delay
    _getMinRetryCount().then((minRetry) {
      final delay = _config.getDelay(minRetry);

      _retryTimer = Timer(delay, () {
        _executeRetry();
      });
    });
  }

  Future<int> _getMinRetryCount() async {
    final db = await _db.database;
    final result = await db.rawQuery(
      '''
      SELECT MIN(retry_count) as min_retry 
      FROM sync_queue 
      WHERE status = 'PENDING' AND retry_count > 0
      ''',
    );

    if (result.isEmpty || result.first['min_retry'] == null) {
      return 0;
    }

    return result.first['min_retry'] as int;
  }

  Future<void> _executeRetry() async {
    _isRetrying = true;

    try {
      // Reset failed events that can be retried
      final resetCount = await _queue.resetFailedForRetry(
        maxRetries: _config.maxRetries,
      );

      if (resetCount > 0) {
        // Trigger sync through callback or event
        _onRetryReady?.call();
      }
    } finally {
      _isRetrying = false;
    }
  }

  /// Callback when retry is ready
  void Function()? _onRetryReady;

  void setOnRetryReady(void Function() callback) {
    _onRetryReady = callback;
  }

  /// Get retry statistics
  Future<RetryStats> getStats() async {
    final db = await _db.database;

    final pendingResult = await db.rawQuery(
      "SELECT COUNT(*) as count FROM sync_queue WHERE status = 'PENDING'",
    );
    final failedResult = await db.rawQuery(
      "SELECT COUNT(*) as count FROM sync_queue WHERE status = 'FAILED'",
    );
    final maxRetriesResult = await db.rawQuery(
      '''
      SELECT COUNT(*) as count FROM sync_queue 
      WHERE status = 'FAILED' AND retry_count >= ?
      ''',
      [_config.maxRetries],
    );
    final avgRetryResult = await db.rawQuery(
      '''
      SELECT AVG(retry_count) as avg FROM sync_queue 
      WHERE retry_count > 0
      ''',
    );

    return RetryStats(
      pendingCount: (pendingResult.first['count'] as int?) ?? 0,
      failedCount: (failedResult.first['count'] as int?) ?? 0,
      permanentlyFailedCount: (maxRetriesResult.first['count'] as int?) ?? 0,
      averageRetryCount: (avgRetryResult.first['avg'] as num?)?.toDouble() ?? 0,
    );
  }

  /// Clear all failed events
  Future<int> clearFailedEvents() async {
    final db = await _db.database;
    return await db.delete(
      'sync_queue',
      where: 'status = ?',
      whereArgs: ['FAILED'],
    );
  }

  /// Force retry all failed events
  Future<int> forceRetryAll() async {
    final db = await _db.database;
    return await db.rawUpdate(
      '''
      UPDATE sync_queue 
      SET status = 'PENDING', retry_count = 0
      WHERE status = 'FAILED'
      ''',
    );
  }

  /// Cancel pending retry
  void cancelPendingRetry() {
    _retryTimer?.cancel();
    _retryTimer = null;
  }

  /// Dispose resources
  void dispose() {
    cancelPendingRetry();
  }
}

/// Retry statistics
class RetryStats {
  final int pendingCount;
  final int failedCount;
  final int permanentlyFailedCount;
  final double averageRetryCount;

  RetryStats({
    required this.pendingCount,
    required this.failedCount,
    required this.permanentlyFailedCount,
    required this.averageRetryCount,
  });

  @override
  String toString() {
    return 'RetryStats(pending: $pendingCount, failed: $failedCount, '
        'permanent: $permanentlyFailedCount, avgRetry: ${averageRetryCount.toStringAsFixed(1)})';
  }
}
