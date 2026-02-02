import '../models/models.dart';

/// Route configuration with role-based access control.
/// Single source of truth for all route permissions.
class AppRouteConfig {
  final String path;
  final Set<UserRole> allowedRoles;
  final bool requiresAuth;

  const AppRouteConfig({
    required this.path,
    required this.allowedRoles,
    this.requiresAuth = true,
  });

  /// Check if a role can access this route
  bool isAllowedFor(UserRole? role) {
    if (!requiresAuth) return true;
    if (role == null) return false;
    if (allowedRoles.isEmpty) return true; // Empty = all authenticated users
    return allowedRoles.contains(role);
  }
}

/// Centralized route registry with permissions
abstract class AppRouteRegistry {
  // Public routes (no auth required)
  static const login = AppRouteConfig(
    path: '/login',
    allowedRoles: {},
    requiresAuth: false,
  );

  // Home - all authenticated users
  static const home = AppRouteConfig(
    path: '/',
    allowedRoles: {},
  );

  // Reception - ADMIN, APPRO only
  static const reception = AppRouteConfig(
    path: '/reception',
    allowedRoles: {UserRole.admin, UserRole.appro},
  );

  // Production consume - ADMIN, PRODUCTION only
  static const productionConsume = AppRouteConfig(
    path: '/production/consume',
    allowedRoles: {UserRole.admin, UserRole.production},
  );

  // Production finish - ADMIN, PRODUCTION only
  static const productionFinish = AppRouteConfig(
    path: '/production/finish',
    allowedRoles: {UserRole.admin, UserRole.production},
  );

  // Sales create - ADMIN, COMMERCIAL only
  static const salesCreate = AppRouteConfig(
    path: '/sales/create',
    allowedRoles: {UserRole.admin, UserRole.commercial},
  );

  // Invoice detail - ADMIN, COMMERCIAL, COMPTABLE
  static const invoiceDetail = AppRouteConfig(
    path: '/invoice/:id',
    allowedRoles: {UserRole.admin, UserRole.commercial, UserRole.comptable},
  );

  // Stock PF - all authenticated users
  static const stockPf = AppRouteConfig(
    path: '/stock/pf',
    allowedRoles: {},
  );

  // Sync - all authenticated users
  static const sync = AppRouteConfig(
    path: '/sync',
    allowedRoles: {},
  );

  // Settings - all authenticated users
  static const settings = AppRouteConfig(
    path: '/settings',
    allowedRoles: {},
  );

  /// All routes indexed by path for lookup
  static final Map<String, AppRouteConfig> _routeMap = {
    login.path: login,
    home.path: home,
    reception.path: reception,
    productionConsume.path: productionConsume,
    productionFinish.path: productionFinish,
    salesCreate.path: salesCreate,
    invoiceDetail.path: invoiceDetail,
    stockPf.path: stockPf,
    sync.path: sync,
    settings.path: settings,
  };

  /// Find route config by path (handles dynamic segments)
  static AppRouteConfig? findByPath(String path) {
    // Exact match first
    if (_routeMap.containsKey(path)) {
      return _routeMap[path];
    }
    
    // Handle dynamic routes (e.g., /invoice/123 -> /invoice/:id)
    for (final entry in _routeMap.entries) {
      if (_matchDynamicPath(entry.key, path)) {
        return entry.value;
      }
    }
    
    return null;
  }

  /// Match paths with dynamic segments
  static bool _matchDynamicPath(String pattern, String path) {
    final patternParts = pattern.split('/');
    final pathParts = path.split('/');
    
    if (patternParts.length != pathParts.length) return false;
    
    for (var i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) continue; // Dynamic segment
      if (patternParts[i] != pathParts[i]) return false;
    }
    
    return true;
  }
}

/// Global role guard function - single source of truth
bool canAccessRoute(UserRole? role, String path) {
  final config = AppRouteRegistry.findByPath(path);
  if (config == null) return false; // Unknown route = deny
  return config.isAllowedFor(role);
}
