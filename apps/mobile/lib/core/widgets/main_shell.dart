import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../state/app_state.dart';
import '../models/models.dart';
import '../theme/app_colors.dart';
import '../navigation/app_router.dart';

/// Main shell with bottom navigation
class MainShell extends StatefulWidget {
  final Widget child;

  const MainShell({super.key, required this.child});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    final user = appState.currentUser;
    final role = user?.role ?? UserRole.admin;

    // Build navigation items based on role
    final navItems = _buildNavItems(role);

    return Scaffold(
      body: widget.child,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) => _onNavTap(context, index, navItems),
        items: navItems.map((item) => BottomNavigationBarItem(
          icon: Icon(item.icon),
          activeIcon: Icon(item.activeIcon),
          label: item.label,
        )).toList(),
      ),
    );
  }

  List<_NavItem> _buildNavItems(UserRole role) {
    final items = <_NavItem>[
      const _NavItem(
        icon: Icons.home_outlined,
        activeIcon: Icons.home,
        label: 'Accueil',
        route: AppRoutes.home,
      ),
    ];

    // Stock PF - visible to all
    items.add(const _NavItem(
      icon: Icons.inventory_2_outlined,
      activeIcon: Icons.inventory_2,
      label: 'Stock',
      route: AppRoutes.stockPf,
    ));

    // Sync - visible to all
    items.add(const _NavItem(
      icon: Icons.sync_outlined,
      activeIcon: Icons.sync,
      label: 'Sync',
      route: AppRoutes.sync,
    ));

    // Settings - visible to all (content varies by role)
    items.add(const _NavItem(
      icon: Icons.settings_outlined,
      activeIcon: Icons.settings,
      label: 'Paramètres',
      route: AppRoutes.settings,
    ));

    return items;
  }

  void _onNavTap(BuildContext context, int index, List<_NavItem> items) {
    if (index == _currentIndex) return;
    
    setState(() => _currentIndex = index);
    context.go(items[index].route);
  }
}

class _NavItem {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final String route;

  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.route,
  });
}
