/// Manchengo Smart ERP - Offline-First Core Module
/// 
/// This module provides complete offline-first functionality for the mobile app:
/// - SQLite local database with sync queue
/// - Push/Pull sync engine with server
/// - Retry management with exponential backoff
/// - Append-only audit trail
/// - Offline authentication with 72h grace period
/// - Device registration and management

library offline;

export 'database.dart';
export 'sync_queue.dart';
export 'sync_engine.dart';
export 'retry_manager.dart';
export 'audit_service.dart';
export 'auth_offline.dart';
export 'device_manager.dart';
