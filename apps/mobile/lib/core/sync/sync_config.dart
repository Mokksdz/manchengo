/// Sync configuration constants
abstract class SyncConfig {
  /// Server API base URL
  /// TODO: Move to environment config for production
  static const String apiBaseUrl = 'https://api.manchengo.dz';
  
  /// Sync endpoint path
  static const String syncEventsPath = '/api/sync/events';
  
  /// Full sync endpoint URL
  static String get syncEventsUrl => '$apiBaseUrl$syncEventsPath';
  
  /// Maximum events per batch
  static const int batchSize = 20;
  
  /// HTTP request timeout
  static const Duration requestTimeout = Duration(seconds: 30);
  
  /// Retry delays (exponential backoff)
  static const List<Duration> retryDelays = [
    Duration(seconds: 1),
    Duration(seconds: 2),
    Duration(seconds: 5),
    Duration(seconds: 10),
    Duration(seconds: 30),
  ];
  
  /// Maximum retry attempts
  static const int maxRetries = 5;
}
