import 'dart:convert';
import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:uuid/uuid.dart';
import 'package:http/http.dart' as http;
import 'database.dart';
import 'auth_offline.dart';

/// Device information
class DeviceInfo {
  final String id;
  final String name;
  final String platform;
  final String osVersion;
  final String appVersion;
  final String? model;
  final String? manufacturer;

  DeviceInfo({
    required this.id,
    required this.name,
    required this.platform,
    required this.osVersion,
    required this.appVersion,
    this.model,
    this.manufacturer,
  });

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'platform': platform,
      'osVersion': osVersion,
      'appVersion': appVersion,
      'model': model,
      'manufacturer': manufacturer,
    };
  }
}

/// Device registration response
class DeviceRegistrationResponse {
  final bool success;
  final String? deviceId;
  final String? message;
  final bool isActive;

  DeviceRegistrationResponse({
    required this.success,
    this.deviceId,
    this.message,
    this.isActive = true,
  });

  factory DeviceRegistrationResponse.fromJson(Map<String, dynamic> json) {
    return DeviceRegistrationResponse(
      success: json['success'] as bool? ?? false,
      deviceId: json['deviceId'] as String?,
      message: json['message'] as String?,
      isActive: json['isActive'] as bool? ?? true,
    );
  }
}

/// Device status from server
class DeviceServerStatus {
  final bool isActive;
  final bool isRevoked;
  final DateTime? lastSyncAt;
  final int pendingEvents;
  final String? message;

  DeviceServerStatus({
    required this.isActive,
    required this.isRevoked,
    this.lastSyncAt,
    this.pendingEvents = 0,
    this.message,
  });

  factory DeviceServerStatus.fromJson(Map<String, dynamic> json) {
    return DeviceServerStatus(
      isActive: json['isActive'] as bool? ?? false,
      isRevoked: json['isRevoked'] as bool? ?? false,
      lastSyncAt: json['lastSyncAt'] != null
          ? DateTime.parse(json['lastSyncAt'] as String)
          : null,
      pendingEvents: json['pendingEvents'] as int? ?? 0,
      message: json['message'] as String?,
    );
  }
}

/// Manages device registration and status
class DeviceManager {
  final OfflineDatabase _db;
  final AuthOffline _authOffline;
  final String _baseUrl;

  final DeviceInfoPlugin _deviceInfoPlugin = DeviceInfoPlugin();
  final Uuid _uuid = const Uuid();

  DeviceInfo? _cachedDeviceInfo;

  DeviceManager({
    required OfflineDatabase db,
    required AuthOffline authOffline,
    required String baseUrl,
  })  : _db = db,
        _authOffline = authOffline,
        _baseUrl = baseUrl;

  /// Get or create device ID
  Future<String> getOrCreateDeviceId() async {
    var deviceId = await _db.getDeviceId();

    if (deviceId == null || deviceId.isEmpty) {
      deviceId = _uuid.v4();
      await _db.setDeviceId(deviceId);
    }

    return deviceId;
  }

  /// Get device information
  Future<DeviceInfo> getDeviceInfo() async {
    if (_cachedDeviceInfo != null) {
      return _cachedDeviceInfo!;
    }

    final deviceId = await getOrCreateDeviceId();
    final packageInfo = await PackageInfo.fromPlatform();

    String platform;
    String osVersion;
    String name;
    String? model;
    String? manufacturer;

    if (Platform.isAndroid) {
      platform = 'android';
      final androidInfo = await _deviceInfoPlugin.androidInfo;
      osVersion = 'Android ${androidInfo.version.release}';
      name = androidInfo.model;
      model = androidInfo.model;
      manufacturer = androidInfo.manufacturer;
    } else if (Platform.isIOS) {
      platform = 'ios';
      final iosInfo = await _deviceInfoPlugin.iosInfo;
      osVersion = '${iosInfo.systemName} ${iosInfo.systemVersion}';
      name = iosInfo.name;
      model = iosInfo.model;
      manufacturer = 'Apple';
    } else {
      platform = 'unknown';
      osVersion = 'unknown';
      name = 'Unknown Device';
    }

    _cachedDeviceInfo = DeviceInfo(
      id: deviceId,
      name: name,
      platform: platform,
      osVersion: osVersion,
      appVersion: packageInfo.version,
      model: model,
      manufacturer: manufacturer,
    );

    return _cachedDeviceInfo!;
  }

  /// Register device with server
  Future<DeviceRegistrationResponse> registerDevice(String userId) async {
    final deviceInfo = await getDeviceInfo();
    final accessToken = await _authOffline.getAccessToken();

    if (accessToken == null) {
      return DeviceRegistrationResponse(
        success: false,
        message: 'Not authenticated',
      );
    }

    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/api/devices/register'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $accessToken',
        },
        body: jsonEncode({
          'deviceId': deviceInfo.id,
          'userId': userId,
          'name': deviceInfo.name,
          'platform': deviceInfo.platform,
          'appVersion': deviceInfo.appVersion,
          'osVersion': deviceInfo.osVersion,
          'model': deviceInfo.model,
          'manufacturer': deviceInfo.manufacturer,
        }),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        return DeviceRegistrationResponse.fromJson(data);
      } else if (response.statusCode == 403) {
        // Device limit exceeded or revoked
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        return DeviceRegistrationResponse(
          success: false,
          message: data['message'] as String? ?? 'Registration failed',
          isActive: false,
        );
      } else {
        return DeviceRegistrationResponse(
          success: false,
          message: 'Registration failed: ${response.statusCode}',
        );
      }
    } catch (e) {
      return DeviceRegistrationResponse(
        success: false,
        message: 'Network error: $e',
      );
    }
  }

  /// Check device status with server
  Future<DeviceServerStatus?> checkDeviceStatus() async {
    final deviceId = await _db.getDeviceId();
    final accessToken = await _authOffline.getAccessToken();

    if (deviceId == null || accessToken == null) {
      return null;
    }

    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/api/devices/$deviceId/status'),
        headers: {
          'Authorization': 'Bearer $accessToken',
          'X-Device-Id': deviceId,
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final status = DeviceServerStatus.fromJson(data);

        // Handle revoked device
        if (status.isRevoked || !status.isActive) {
          await _handleDeviceRevoked();
        }

        return status;
      } else if (response.statusCode == 404) {
        // Device not found - needs re-registration
        return DeviceServerStatus(
          isActive: false,
          isRevoked: false,
          message: 'Device not registered',
        );
      } else if (response.statusCode == 403) {
        // Device revoked
        await _handleDeviceRevoked();
        return DeviceServerStatus(
          isActive: false,
          isRevoked: true,
          message: 'Device revoked',
        );
      }

      return null;
    } catch (e) {
      // Network error - return null to indicate unknown status
      return null;
    }
  }

  /// Handle device revocation
  Future<void> _handleDeviceRevoked() async {
    await _authOffline.handleDeviceRevoked();
  }

  /// Perform local wipe (clear all data)
  Future<void> wipeLocalData() async {
    await _db.clearAllData();
    _cachedDeviceInfo = null;
  }

  /// Get battery level (for context in audit)
  Future<int?> getBatteryLevel() async {
    // This would require battery_plus package
    // Returning null for now - implement if needed
    return null;
  }

  /// Get network type
  Future<String> getNetworkType() async {
    // This would require connectivity_plus package
    // Returning 'unknown' for now - implement if needed
    return 'unknown';
  }

  /// Check if device is registered
  Future<bool> isDeviceRegistered() async {
    final deviceId = await _db.getDeviceId();
    return deviceId != null && deviceId.isNotEmpty;
  }

  /// Unregister device (logout)
  Future<bool> unregisterDevice() async {
    final deviceId = await _db.getDeviceId();
    final accessToken = await _authOffline.getAccessToken();

    if (deviceId == null || accessToken == null) {
      return false;
    }

    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/api/devices/$deviceId/unregister'),
        headers: {
          'Authorization': 'Bearer $accessToken',
          'X-Device-Id': deviceId,
        },
      );

      if (response.statusCode == 200) {
        // Clear local data
        await _authOffline.clearSession();
        return true;
      }

      return false;
    } catch (e) {
      // Even if server call fails, clear local session
      await _authOffline.clearSession();
      return false;
    }
  }

  /// Update app version on server
  Future<void> updateAppVersion() async {
    final deviceId = await _db.getDeviceId();
    final accessToken = await _authOffline.getAccessToken();
    final packageInfo = await PackageInfo.fromPlatform();

    if (deviceId == null || accessToken == null) {
      return;
    }

    try {
      await http.patch(
        Uri.parse('$_baseUrl/api/devices/$deviceId'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $accessToken',
          'X-Device-Id': deviceId,
        },
        body: jsonEncode({
          'appVersion': packageInfo.version,
        }),
      );
    } catch (e) {
      // Ignore errors - not critical
    }
  }
}
