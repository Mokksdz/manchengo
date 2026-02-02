import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../core/state/app_state.dart';
import '../../core/models/models.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/navigation/app_router.dart';
import '../../core/navigation/route_config.dart';
import '../../core/widgets/sync_indicator.dart';
import '../../core/widgets/stats_card.dart';
import '../../core/widgets/section_header.dart';
import '../../core/widgets/status_badge.dart';

/// Home dashboard screen
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    final user = appState.currentUser;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Manchengo ERP'),
        actions: const [
          Padding(
            padding: EdgeInsets.only(right: 16),
            child: SyncIndicator(),
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Greeting
              _buildGreeting(user),
              const SizedBox(height: 24),

              // Stats grid
              _buildStatsGrid(context, appState, user),
              const SizedBox(height: 24),

              // Recent activity
              const SectionHeader(title: 'ACTIVITÉS RÉCENTES'),
              _buildActivityList(appState),
              const SizedBox(height: 100), // Space for FAB
            ],
          ),
        ),
      ),
      floatingActionButton: _buildScanFab(context),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
    );
  }

  Widget _buildGreeting(User? user) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Bonjour, ${user?.firstName ?? 'Utilisateur'}',
          style: AppTypography.h1,
        ),
        const SizedBox(height: 4),
        if (user != null) StatusBadge.role(user.role),
      ],
    );
  }

  Widget _buildStatsGrid(BuildContext context, AppState appState, User? user) {
    final role = user?.role;
    
    return GridView.count(
      crossAxisCount: 2,
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      childAspectRatio: 1.4,
      children: [
        // Reception - uses centralized guard
        if (canAccessRoute(role, AppRoutes.reception))
          StatsCard(
            icon: Icons.download_outlined,
            label: 'Réceptions',
            value: '${appState.todayReceptions}',
            iconColor: AppColors.domainMp,
            onTap: () => context.push(AppRoutes.reception),
          ),

        // Production - uses centralized guard
        if (canAccessRoute(role, AppRoutes.productionConsume))
          StatsCard(
            icon: Icons.factory_outlined,
            label: 'Productions',
            value: '${appState.todayProductions}',
            iconColor: AppColors.domainProduction,
            onTap: () => context.push(AppRoutes.productionConsume),
          ),

        // Sales - uses centralized guard
        if (canAccessRoute(role, AppRoutes.salesCreate))
          StatsCard(
            icon: Icons.shopping_cart_outlined,
            label: 'Ventes',
            value: '${appState.todaySales}',
            iconColor: AppColors.domainPf,
            onTap: () => context.push(AppRoutes.salesCreate),
          ),

        // Stock - all authenticated users
        if (canAccessRoute(role, AppRoutes.stockPf))
          StatsCard(
            icon: Icons.inventory_2_outlined,
            label: 'Stock PF',
            value: 'OK',
            iconColor: AppColors.success,
            onTap: () => context.go(AppRoutes.stockPf),
          ),
      ],
    );
  }

  Widget _buildActivityList(AppState appState) {
    final activities = appState.recentActivity;

    if (activities.isEmpty) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Center(
            child: Column(
              children: [
                Icon(
                  Icons.history,
                  size: 48,
                  color: AppColors.neutral300,
                ),
                const SizedBox(height: 8),
                Text(
                  'Aucune activité récente',
                  style: AppTypography.caption,
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Card(
      child: Column(
        children: activities.map((activity) {
          final timeFormat = DateFormat('HH:mm');
          return ListTile(
            leading: CircleAvatar(
              backgroundColor: activity.isCompleted 
                  ? AppColors.successLight 
                  : AppColors.warningLight,
              child: Icon(
                activity.isCompleted ? Icons.check : Icons.schedule,
                color: activity.isCompleted 
                    ? AppColors.success 
                    : AppColors.warning,
                size: 20,
              ),
            ),
            title: Text(
              '${activity.type} ${activity.reference}',
              style: AppTypography.bodyMedium,
            ),
            subtitle: Text(
              activity.userName,
              style: AppTypography.caption,
            ),
            trailing: Text(
              timeFormat.format(activity.timestamp),
              style: AppTypography.caption,
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildScanFab(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: FloatingActionButton.extended(
          onPressed: () {
            // TODO: Implement QR scanner
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Scanner QR non implémenté')),
            );
          },
          icon: const Icon(Icons.qr_code_scanner),
          label: const Text('SCANNER QR CODE'),
        ),
      ),
    );
  }
}
