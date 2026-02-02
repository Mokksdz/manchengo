import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../state/app_state.dart';
import 'route_config.dart';
import '../../features/home/home_screen.dart';
import '../../features/reception/reception_screen.dart';
import '../../features/production/production_consume_screen.dart';
import '../../features/production/production_finish_screen.dart';
import '../../features/sales/sales_create_screen.dart';
import '../../features/invoices/invoice_detail_screen.dart';
import '../../features/stock/stock_pf_screen.dart';
import '../../features/sync/sync_screen.dart';
import '../../features/settings/settings_screen.dart';
import '../../features/auth/login_screen.dart';
import '../widgets/main_shell.dart';

/// App route paths - uses AppRouteRegistry as source of truth
abstract class AppRoutes {
  static String get login => AppRouteRegistry.login.path;
  static String get home => AppRouteRegistry.home.path;
  static String get reception => AppRouteRegistry.reception.path;
  static String get productionConsume => AppRouteRegistry.productionConsume.path;
  static String get productionFinish => AppRouteRegistry.productionFinish.path;
  static String get salesCreate => AppRouteRegistry.salesCreate.path;
  static String get invoiceDetail => AppRouteRegistry.invoiceDetail.path;
  static String get stockPf => AppRouteRegistry.stockPf.path;
  static String get sync => AppRouteRegistry.sync.path;
  static String get settings => AppRouteRegistry.settings.path;
}

/// Router configuration
final appRouter = GoRouter(
  initialLocation: AppRoutes.home,
  debugLogDiagnostics: true,
  routes: [
    // Login (no shell)
    GoRoute(
      path: AppRoutes.login,
      builder: (context, state) => const LoginScreen(),
    ),
    
    // Main app shell with bottom navigation
    ShellRoute(
      builder: (context, state, child) => MainShell(child: child),
      routes: [
        GoRoute(
          path: AppRoutes.home,
          pageBuilder: (context, state) => const NoTransitionPage(
            child: HomeScreen(),
          ),
        ),
        GoRoute(
          path: AppRoutes.stockPf,
          pageBuilder: (context, state) => const NoTransitionPage(
            child: StockPfScreen(),
          ),
        ),
        GoRoute(
          path: AppRoutes.sync,
          pageBuilder: (context, state) => const NoTransitionPage(
            child: SyncScreen(),
          ),
        ),
        GoRoute(
          path: AppRoutes.settings,
          pageBuilder: (context, state) => const NoTransitionPage(
            child: SettingsScreen(),
          ),
        ),
      ],
    ),
    
    // Standalone screens (no bottom nav)
    GoRoute(
      path: AppRoutes.reception,
      builder: (context, state) => const ReceptionScreen(),
    ),
    GoRoute(
      path: AppRoutes.productionConsume,
      builder: (context, state) => const ProductionConsumeScreen(),
    ),
    GoRoute(
      path: AppRoutes.productionFinish,
      builder: (context, state) => const ProductionFinishScreen(),
    ),
    GoRoute(
      path: AppRoutes.salesCreate,
      builder: (context, state) => const SalesCreateScreen(),
    ),
    GoRoute(
      path: AppRoutes.invoiceDetail,
      builder: (context, state) {
        final invoiceId = state.pathParameters['id'] ?? '';
        return InvoiceDetailScreen(invoiceId: invoiceId);
      },
    ),
  ],
  
  // Redirect logic - uses centralized role guard
  redirect: (context, state) {
    final appState = context.read<AppState>();
    final isLoggedIn = appState.isLoggedIn;
    final location = state.matchedLocation;
    final routeConfig = AppRouteRegistry.findByPath(location);
    
    // Unknown route - redirect to home
    if (routeConfig == null) {
      return AppRoutes.home;
    }
    
    // Public route (no auth required)
    if (!routeConfig.requiresAuth) {
      // Redirect to home if already logged in and on login page
      if (isLoggedIn && location == AppRoutes.login) {
        return AppRoutes.home;
      }
      return null;
    }
    
    // Protected route - require auth
    if (!isLoggedIn) {
      return AppRoutes.login;
    }
    
    // Role-based access control via centralized guard
    final userRole = appState.currentUser?.role;
    if (!canAccessRoute(userRole, location)) {
      return AppRoutes.home;
    }
    
    return null;
  },
);
