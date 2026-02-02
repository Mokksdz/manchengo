import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

/// Device identity for sync events
/// 
/// Generates and persists a unique device UUID once.
/// Used to identify this device in sync events.
class DeviceIdentity {
  static const String _key = 'device_id';
  static String? _cachedId;

  /// Get device ID (generates if not exists)
  static Future<String> getDeviceId() async {
    // Return cached if available
    if (_cachedId != null) return _cachedId!;

    final prefs = await SharedPreferences.getInstance();
    var deviceId = prefs.getString(_key);

    if (deviceId == null) {
      // Generate new UUID
      deviceId = const Uuid().v4();
      await prefs.setString(_key, deviceId);
    }

    _cachedId = deviceId;
    return deviceId;
  }

  /// Clear device ID (for testing only)
  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
    _cachedId = null;
  }
}
