import 'package:shared_preferences/shared_preferences.dart';

/// Sync state metadata persistence
/// 
/// Stores sync timestamps for pull sync coordination.
class SyncState {
  static const String _keyLastPullAt = 'sync_last_pull_at';
  static const String _keyLastServerTime = 'sync_last_server_time';
  static const String _keyLastSuccessfulSync = 'sync_last_successful';

  /// Get last pull timestamp (for since parameter)
  static Future<DateTime?> getLastPullAt() async {
    final prefs = await SharedPreferences.getInstance();
    final value = prefs.getString(_keyLastPullAt);
    return value != null ? DateTime.parse(value) : null;
  }

  /// Set last pull timestamp
  static Future<void> setLastPullAt(DateTime value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyLastPullAt, value.toUtc().toIso8601String());
  }

  /// Get last server time (from server response)
  static Future<DateTime?> getLastServerTime() async {
    final prefs = await SharedPreferences.getInstance();
    final value = prefs.getString(_keyLastServerTime);
    return value != null ? DateTime.parse(value) : null;
  }

  /// Set last server time
  static Future<void> setLastServerTime(DateTime value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyLastServerTime, value.toUtc().toIso8601String());
  }

  /// Get last successful sync timestamp
  static Future<DateTime?> getLastSuccessfulSync() async {
    final prefs = await SharedPreferences.getInstance();
    final value = prefs.getString(_keyLastSuccessfulSync);
    return value != null ? DateTime.parse(value) : null;
  }

  /// Set last successful sync timestamp
  static Future<void> setLastSuccessfulSync(DateTime value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyLastSuccessfulSync, value.toUtc().toIso8601String());
  }

  /// Clear all sync state (for reset/logout)
  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyLastPullAt);
    await prefs.remove(_keyLastServerTime);
    await prefs.remove(_keyLastSuccessfulSync);
  }
}
