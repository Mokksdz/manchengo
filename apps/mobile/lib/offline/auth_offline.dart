import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'database.dart';

/// Authentication status
enum AuthStatus {
  authenticated,
  tokenExpired,
  offlineExpired,
  notAuthenticated,
  deviceRevoked,
}

/// User session data
class UserSession {
  final String userId;
  final String email;
  final String firstName;
  final String lastName;
  final String role;
  final DateTime? tokenExpires;
  final DateTime? lastAuthAt;
  final String deviceId;

  UserSession({
    required this.userId,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.role,
    this.tokenExpires,
    this.lastAuthAt,
    required this.deviceId,
  });

  factory UserSession.fromMap(Map<String, dynamic> map) {
    return UserSession(
      userId: map['user_id'] as String,
      email: map['email'] as String,
      firstName: map['first_name'] as String,
      lastName: map['last_name'] as String,
      role: map['role'] as String,
      tokenExpires: map['token_expires'] != null
          ? DateTime.parse(map['token_expires'] as String)
          : null,
      lastAuthAt: map['last_auth_at'] != null
          ? DateTime.parse(map['last_auth_at'] as String)
          : null,
      deviceId: map['device_id'] as String,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': 1, // Single row constraint
      'user_id': userId,
      'email': email,
      'first_name': firstName,
      'last_name': lastName,
      'role': role,
      'token_expires': tokenExpires?.toUtc().toIso8601String(),
      'last_auth_at': lastAuthAt?.toUtc().toIso8601String(),
      'device_id': deviceId,
    };
  }

  bool get isOfflineGracePeriodValid {
    if (lastAuthAt == null) return false;
    final gracePeriodEnd = lastAuthAt!.add(const Duration(hours: 72));
    return DateTime.now().isBefore(gracePeriodEnd);
  }

  Duration get timeUntilOfflineExpiry {
    if (lastAuthAt == null) return Duration.zero;
    final gracePeriodEnd = lastAuthAt!.add(const Duration(hours: 72));
    return gracePeriodEnd.difference(DateTime.now());
  }
}

/// Offline authentication manager
class AuthOffline {
  final OfflineDatabase _db;
  final FlutterSecureStorage _secureStorage;

  static const String _accessTokenKey = 'access_token';
  static const String _refreshTokenKey = 'refresh_token';
  static const String _offlinePinKey = 'offline_pin_hash';
  static const Duration _offlineGracePeriod = Duration(hours: 72);

  AuthOffline(this._db)
      : _secureStorage = const FlutterSecureStorage(
          aOptions: AndroidOptions(encryptedSharedPreferences: true),
          iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
        );

  /// Get current authentication status
  Future<AuthStatus> getAuthStatus() async {
    final session = await getSession();

    if (session == null) {
      return AuthStatus.notAuthenticated;
    }

    // Check if device was revoked
    final deviceRevoked = await _secureStorage.read(key: 'device_revoked');
    if (deviceRevoked == 'true') {
      return AuthStatus.deviceRevoked;
    }

    // Check offline grace period
    if (!session.isOfflineGracePeriodValid) {
      return AuthStatus.offlineExpired;
    }

    // Check token expiry
    if (session.tokenExpires != null &&
        DateTime.now().isAfter(session.tokenExpires!)) {
      return AuthStatus.tokenExpired;
    }

    return AuthStatus.authenticated;
  }

  /// Get current user session
  Future<UserSession?> getSession() async {
    final db = await _db.database;
    final results = await db.query('user_session', limit: 1);

    if (results.isEmpty) return null;

    return UserSession.fromMap(results.first);
  }

  /// Save user session after login
  Future<void> saveSession({
    required String userId,
    required String email,
    required String firstName,
    required String lastName,
    required String role,
    required String accessToken,
    required String refreshToken,
    required DateTime tokenExpires,
    required String deviceId,
  }) async {
    final db = await _db.database;

    // Save tokens securely
    await _secureStorage.write(key: _accessTokenKey, value: accessToken);
    await _secureStorage.write(key: _refreshTokenKey, value: refreshToken);

    // Clear any previous revocation flag
    await _secureStorage.delete(key: 'device_revoked');

    // Save session to database
    final session = UserSession(
      userId: userId,
      email: email,
      firstName: firstName,
      lastName: lastName,
      role: role,
      tokenExpires: tokenExpires,
      lastAuthAt: DateTime.now(),
      deviceId: deviceId,
    );

    await db.insert(
      'user_session',
      session.toMap(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );

    // Update device ID in sync_meta
    await _db.setDeviceId(deviceId);
  }

  /// Update tokens after refresh
  Future<void> updateTokens({
    required String accessToken,
    required String refreshToken,
    required DateTime tokenExpires,
  }) async {
    await _secureStorage.write(key: _accessTokenKey, value: accessToken);
    await _secureStorage.write(key: _refreshTokenKey, value: refreshToken);

    final db = await _db.database;
    await db.update(
      'user_session',
      {
        'token_expires': tokenExpires.toUtc().toIso8601String(),
        'last_auth_at': DateTime.now().toUtc().toIso8601String(),
      },
      where: 'id = 1',
    );
  }

  /// Get access token
  Future<String?> getAccessToken() async {
    return await _secureStorage.read(key: _accessTokenKey);
  }

  /// Get refresh token
  Future<String?> getRefreshToken() async {
    return await _secureStorage.read(key: _refreshTokenKey);
  }

  /// Set offline PIN for extended offline access
  Future<void> setOfflinePin(String pin) async {
    final salt = await _getOrCreateSalt();
    final hash = _hashPin(pin, salt);
    await _secureStorage.write(key: _offlinePinKey, value: hash);
  }

  /// Verify offline PIN
  Future<bool> verifyOfflinePin(String pin) async {
    final storedHash = await _secureStorage.read(key: _offlinePinKey);
    if (storedHash == null) return false;

    final salt = await _getOrCreateSalt();
    final hash = _hashPin(pin, salt);

    return hash == storedHash;
  }

  /// Check if offline PIN is set
  Future<bool> hasOfflinePin() async {
    final hash = await _secureStorage.read(key: _offlinePinKey);
    return hash != null;
  }

  /// Remove offline PIN
  Future<void> removeOfflinePin() async {
    await _secureStorage.delete(key: _offlinePinKey);
  }

  String _hashPin(String pin, String salt) {
    final bytes = utf8.encode(pin + salt);
    return sha256.convert(bytes).toString();
  }

  Future<String> _getOrCreateSalt() async {
    var salt = await _secureStorage.read(key: 'pin_salt');
    if (salt == null) {
      salt = DateTime.now().millisecondsSinceEpoch.toString();
      await _secureStorage.write(key: 'pin_salt', value: salt);
    }
    return salt;
  }

  /// Handle token expired - trigger re-authentication
  Future<void> handleTokenExpired() async {
    // Don't clear session, just mark token as expired
    // User can still work offline within grace period
    final db = await _db.database;
    await db.update(
      'user_session',
      {'token_expires': DateTime.now().subtract(const Duration(hours: 1)).toUtc().toIso8601String()},
      where: 'id = 1',
    );
  }

  /// Handle device revoked - clear all data
  Future<void> handleDeviceRevoked() async {
    // Mark device as revoked
    await _secureStorage.write(key: 'device_revoked', value: 'true');

    // Clear all sensitive data
    await clearSession();

    // Clear all local data
    await _db.clearAllData();
  }

  /// Clear session (logout)
  Future<void> clearSession() async {
    // Clear secure storage
    await _secureStorage.delete(key: _accessTokenKey);
    await _secureStorage.delete(key: _refreshTokenKey);
    await _secureStorage.delete(key: _offlinePinKey);

    // Clear session from database
    final db = await _db.database;
    await db.delete('user_session');
  }

  /// Check if user can operate offline
  Future<bool> canOperateOffline() async {
    final status = await getAuthStatus();
    return status == AuthStatus.authenticated ||
        status == AuthStatus.tokenExpired;
  }

  /// Get remaining offline time
  Future<Duration?> getRemainingOfflineTime() async {
    final session = await getSession();
    if (session == null) return null;

    return session.timeUntilOfflineExpiry;
  }

  /// Extend offline grace period (after successful PIN verification)
  Future<void> extendOfflineGracePeriod() async {
    final db = await _db.database;
    await db.update(
      'user_session',
      {'last_auth_at': DateTime.now().toUtc().toIso8601String()},
      where: 'id = 1',
    );
  }
}
