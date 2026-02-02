import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/login_screen.dart';
import '../../features/home/presentation/home_screen.dart';
import '../../features/stock/presentation/stock_screen.dart';
import '../../features/production/presentation/production_screen.dart';
import '../../features/delivery/presentation/delivery_screen.dart';
import '../../features/scanner/presentation/scanner_screen.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/login',
    routes: [
      GoRoute(
        path: '/login',
        name: 'login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/',
        name: 'home',
        builder: (context, state) => const HomeScreen(),
        routes: [
          GoRoute(
            path: 'stock',
            name: 'stock',
            builder: (context, state) => const StockScreen(),
          ),
          GoRoute(
            path: 'production',
            name: 'production',
            builder: (context, state) => const ProductionScreen(),
          ),
          GoRoute(
            path: 'delivery',
            name: 'delivery',
            builder: (context, state) => const DeliveryScreen(),
          ),
          GoRoute(
            path: 'scanner',
            name: 'scanner',
            builder: (context, state) {
              final mode = state.uri.queryParameters['mode'] ?? 'general';
              return ScannerScreen(mode: mode);
            },
          ),
        ],
      ),
    ],
  );
});
