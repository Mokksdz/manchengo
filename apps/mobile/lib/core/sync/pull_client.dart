import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'sync_config.dart';

/// Remote event received from server
class RemoteEvent {
  final String id;
  final String entityType;
  final String entityId;
  final String action;
  final Map<String, dynamic> payload;
  final DateTime occurredAt;
  final String deviceId;
  final int userId;

  const RemoteEvent({
    required this.id,
    required this.entityType,
    required this.entityId,
    required this.action,
    required this.payload,
    required this.occurredAt,
    required this.deviceId,
    required this.userId,
  });

  factory RemoteEvent.fromJson(Map<String, dynamic> json) {
    return RemoteEvent(
      id: json['id'] as String,
      entityType: json['entity_type'] as String,
      entityId: json['entity_id'].toString(),
      action: json['action'] as String,
      payload: json['payload'] as Map<String, dynamic>? ?? {},
      occurredAt: DateTime.parse(json['occurred_at'] as String),
      deviceId: json['device_id'] as String,
      userId: json['user_id'] as int,
    );
  }
}

/// Pull response from server
class PullResponse {
  final List<RemoteEvent> events;
  final DateTime serverTime;

  const PullResponse({
    required this.events,
    required this.serverTime,
  });
}

/// Pull error types
enum PullErrorType {
  network,
  timeout,
  clientError,
  serverError,
  parseError,
}

/// Pull error
class PullError {
  final PullErrorType type;
  final String message;
  final int? statusCode;

  const PullError({
    required this.type,
    required this.message,
    this.statusCode,
  });

  bool get shouldRetry => type == PullErrorType.serverError || 
                          type == PullErrorType.network ||
                          type == PullErrorType.timeout;

  @override
  String toString() => 'PullError($type): $message';
}

/// Result of pull operation
class PullResult {
  final PullResponse? response;
  final PullError? error;

  const PullResult({this.response, this.error});

  bool get isSuccess => response != null && error == null;
  bool get hasError => error != null;
}

/// HTTP client for pulling sync events from server
class PullClient {
  final http.Client _client;

  PullClient({http.Client? client}) : _client = client ?? http.Client();

  /// Fetch events from server since last sync
  Future<PullResult> pullEvents({
    required String deviceId,
    DateTime? since,
  }) async {
    try {
      final uri = Uri.parse(SyncConfig.syncEventsUrl).replace(
        queryParameters: {
          'device_id': deviceId,
          if (since != null) 'since': since.toUtc().toIso8601String(),
        },
      );

      debugPrint('Pull: Fetching events since ${since?.toIso8601String() ?? 'beginning'}');

      final response = await _client
          .get(
            uri,
            headers: {
              'Accept': 'application/json',
            },
          )
          .timeout(SyncConfig.requestTimeout);

      return _handleResponse(response);
    } on SocketException catch (e) {
      debugPrint('Pull: Network error - $e');
      return PullResult(
        error: PullError(
          type: PullErrorType.network,
          message: 'Pas de connexion réseau',
        ),
      );
    } on HttpException catch (e) {
      debugPrint('Pull: HTTP error - $e');
      return PullResult(
        error: PullError(
          type: PullErrorType.network,
          message: 'Erreur de connexion',
        ),
      );
    } catch (e) {
      if (e.toString().contains('TimeoutException')) {
        debugPrint('Pull: Timeout');
        return PullResult(
          error: PullError(
            type: PullErrorType.timeout,
            message: 'Délai de connexion dépassé',
          ),
        );
      }
      debugPrint('Pull: Unknown error - $e');
      return PullResult(
        error: PullError(
          type: PullErrorType.network,
          message: 'Erreur inconnue: $e',
        ),
      );
    }
  }

  PullResult _handleResponse(http.Response response) {
    debugPrint('Pull: Response ${response.statusCode}');

    // Client error (4xx)
    if (response.statusCode >= 400 && response.statusCode < 500) {
      return PullResult(
        error: PullError(
          type: PullErrorType.clientError,
          message: 'Erreur client: ${response.statusCode}',
          statusCode: response.statusCode,
        ),
      );
    }

    // Server error (5xx)
    if (response.statusCode >= 500) {
      return PullResult(
        error: PullError(
          type: PullErrorType.serverError,
          message: 'Erreur serveur: ${response.statusCode}',
          statusCode: response.statusCode,
        ),
      );
    }

    // Success (2xx)
    if (response.statusCode >= 200 && response.statusCode < 300) {
      try {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        
        final eventsJson = json['events'] as List<dynamic>? ?? [];
        final events = eventsJson
            .map((e) => RemoteEvent.fromJson(e as Map<String, dynamic>))
            .toList();

        final serverTime = DateTime.parse(json['server_time'] as String);

        debugPrint('Pull: Received ${events.length} events');

        return PullResult(
          response: PullResponse(
            events: events,
            serverTime: serverTime,
          ),
        );
      } catch (e) {
        debugPrint('Pull: Parse error - $e');
        return PullResult(
          error: PullError(
            type: PullErrorType.parseError,
            message: 'Impossible de parser la réponse',
          ),
        );
      }
    }

    return PullResult(
      error: PullError(
        type: PullErrorType.serverError,
        message: 'Code HTTP inattendu: ${response.statusCode}',
        statusCode: response.statusCode,
      ),
    );
  }

  void dispose() {
    _client.close();
  }
}
