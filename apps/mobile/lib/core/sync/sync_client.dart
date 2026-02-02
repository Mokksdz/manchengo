import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'sync_config.dart';
import 'sync_event.dart';

/// Result of a sync push operation
class SyncPushResult {
  final List<String> ackedEventIds;
  final List<String> failedEventIds;
  final SyncPushError? error;

  const SyncPushResult({
    this.ackedEventIds = const [],
    this.failedEventIds = const [],
    this.error,
  });

  bool get isSuccess => error == null && failedEventIds.isEmpty;
  bool get isPartialSuccess => error == null && ackedEventIds.isNotEmpty;
  bool get hasError => error != null;
}

/// Sync push error types
enum SyncPushErrorType {
  network,      // No connectivity
  timeout,      // Request timeout
  clientError,  // 4xx - stop sync
  serverError,  // 5xx - retry later
  parseError,   // Invalid response
}

/// Sync push error
class SyncPushError {
  final SyncPushErrorType type;
  final String message;
  final int? statusCode;

  const SyncPushError({
    required this.type,
    required this.message,
    this.statusCode,
  });

  bool get shouldRetry => type == SyncPushErrorType.serverError || 
                          type == SyncPushErrorType.network ||
                          type == SyncPushErrorType.timeout;

  @override
  String toString() => 'SyncPushError($type): $message';
}

/// HTTP client for pushing sync events to server
class SyncClient {
  final http.Client _client;

  SyncClient({http.Client? client}) : _client = client ?? http.Client();

  /// Push events to server
  /// 
  /// Returns acked event IDs on success.
  /// Events may be resent safely (idempotent).
  Future<SyncPushResult> pushEvents({
    required String deviceId,
    required List<SyncEvent> events,
  }) async {
    if (events.isEmpty) {
      return const SyncPushResult();
    }

    try {
      final body = jsonEncode({
        'device_id': deviceId,
        'events': events.map((e) => _eventToJson(e)).toList(),
      });

      debugPrint('Sync: Pushing ${events.length} events to server');

      final response = await _client
          .post(
            Uri.parse(SyncConfig.syncEventsUrl),
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: body,
          )
          .timeout(SyncConfig.requestTimeout);

      return _handleResponse(response);
    } on SocketException catch (e) {
      debugPrint('Sync: Network error - $e');
      return SyncPushResult(
        error: SyncPushError(
          type: SyncPushErrorType.network,
          message: 'Pas de connexion réseau',
        ),
      );
    } on HttpException catch (e) {
      debugPrint('Sync: HTTP error - $e');
      return SyncPushResult(
        error: SyncPushError(
          type: SyncPushErrorType.network,
          message: 'Erreur de connexion',
        ),
      );
    } on FormatException catch (e) {
      debugPrint('Sync: Parse error - $e');
      return SyncPushResult(
        error: SyncPushError(
          type: SyncPushErrorType.parseError,
          message: 'Réponse serveur invalide',
        ),
      );
    } catch (e) {
      if (e.toString().contains('TimeoutException')) {
        debugPrint('Sync: Timeout');
        return SyncPushResult(
          error: SyncPushError(
            type: SyncPushErrorType.timeout,
            message: 'Délai de connexion dépassé',
          ),
        );
      }
      debugPrint('Sync: Unknown error - $e');
      return SyncPushResult(
        error: SyncPushError(
          type: SyncPushErrorType.network,
          message: 'Erreur inconnue: $e',
        ),
      );
    }
  }

  SyncPushResult _handleResponse(http.Response response) {
    debugPrint('Sync: Response ${response.statusCode}');

    // Client error (4xx) - stop sync, don't retry
    if (response.statusCode >= 400 && response.statusCode < 500) {
      return SyncPushResult(
        error: SyncPushError(
          type: SyncPushErrorType.clientError,
          message: 'Erreur client: ${response.statusCode}',
          statusCode: response.statusCode,
        ),
      );
    }

    // Server error (5xx) - retry later
    if (response.statusCode >= 500) {
      return SyncPushResult(
        error: SyncPushError(
          type: SyncPushErrorType.serverError,
          message: 'Erreur serveur: ${response.statusCode}',
          statusCode: response.statusCode,
        ),
      );
    }

    // Success (2xx)
    if (response.statusCode >= 200 && response.statusCode < 300) {
      try {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        
        final ackedIds = (json['acked_event_ids'] as List<dynamic>?)
            ?.map((e) => e.toString())
            .toList() ?? [];
        
        final failedIds = (json['failed_event_ids'] as List<dynamic>?)
            ?.map((e) => e.toString())
            .toList() ?? [];

        debugPrint('Sync: Acked ${ackedIds.length}, Failed ${failedIds.length}');

        return SyncPushResult(
          ackedEventIds: ackedIds,
          failedEventIds: failedIds,
        );
      } catch (e) {
        return SyncPushResult(
          error: SyncPushError(
            type: SyncPushErrorType.parseError,
            message: 'Impossible de parser la réponse',
          ),
        );
      }
    }

    // Unexpected status code
    return SyncPushResult(
      error: SyncPushError(
        type: SyncPushErrorType.serverError,
        message: 'Code HTTP inattendu: ${response.statusCode}',
        statusCode: response.statusCode,
      ),
    );
  }

  /// Convert SyncEvent to JSON for API
  Map<String, dynamic> _eventToJson(SyncEvent event) {
    return {
      'id': event.id,
      'entity_type': event.entityType,
      'entity_id': event.entityId,
      'action': event.action,
      'payload': event.payload,
      'occurred_at': event.occurredAt.toUtc().toIso8601String(),
      'user_id': event.userId,
    };
  }

  /// Close HTTP client
  void dispose() {
    _client.close();
  }
}
