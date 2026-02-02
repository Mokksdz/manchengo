import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/state/app_state.dart';
import '../../core/models/models.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/navigation/app_router.dart';
import '../../core/widgets/sync_indicator.dart';
import '../../core/widgets/status_badge.dart';
import '../../core/widgets/section_header.dart';

/// Settings screen
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    final user = appState.currentUser;
    final isAdmin = user?.role == UserRole.admin;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Paramètres'),
        actions: const [
          Padding(
            padding: EdgeInsets.only(right: 16),
            child: SyncIndicator(),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Account section
            const SectionHeader(title: 'COMPTE'),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 28,
                      backgroundColor: AppColors.brandGoldLight,
                      child: Text(
                        user?.firstName.substring(0, 1).toUpperCase() ?? 'U',
                        style: AppTypography.h1.copyWith(color: AppColors.brandGold),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            user?.fullName ?? 'Utilisateur',
                            style: AppTypography.h3,
                          ),
                          const SizedBox(height: 4),
                          if (user != null) StatusBadge.role(user.role),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
            Card(
              child: ListTile(
                leading: const Icon(Icons.logout, color: AppColors.error),
                title: Text(
                  'Se déconnecter',
                  style: AppTypography.body.copyWith(color: AppColors.error),
                ),
                onTap: () => _logout(context, appState),
              ),
            ),
            const SizedBox(height: 24),

            // Device section
            const SectionHeader(title: 'APPAREIL'),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    _buildInfoRow('ID Appareil', 'MCG-D-A1B2C3'),
                    const Divider(height: 24),
                    _buildInfoRow('Version', '1.0.0'),
                    const Divider(height: 24),
                    _buildInfoRow('Base locale', '245 Mo'),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Admin section
            if (isAdmin) ...[
              const SectionHeader(title: 'ADMINISTRATION'),
              Card(
                child: Column(
                  children: [
                    _buildNavItem(
                      context,
                      icon: Icons.people_outline,
                      title: 'Utilisateurs',
                      onTap: () {
                        // TODO: Navigate to users management
                        _showNotImplemented(context);
                      },
                    ),
                    const Divider(height: 1),
                    _buildNavItem(
                      context,
                      icon: Icons.inventory_2_outlined,
                      title: 'Produits',
                      onTap: () {
                        // TODO: Navigate to products management
                        _showNotImplemented(context);
                      },
                    ),
                    const Divider(height: 1),
                    _buildNavItem(
                      context,
                      icon: Icons.local_shipping_outlined,
                      title: 'Fournisseurs',
                      onTap: () {
                        // TODO: Navigate to suppliers management
                        _showNotImplemented(context);
                      },
                    ),
                    const Divider(height: 1),
                    _buildNavItem(
                      context,
                      icon: Icons.storefront_outlined,
                      title: 'Clients',
                      onTap: () {
                        // TODO: Navigate to clients management
                        _showNotImplemented(context);
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
            ],

            // System section
            const SectionHeader(title: 'SYSTÈME'),
            Card(
              child: Column(
                children: [
                  _buildNavItem(
                    context,
                    icon: Icons.download_outlined,
                    title: 'Exporter données',
                    onTap: () {
                      // TODO: Implement data export
                      _showNotImplemented(context);
                    },
                  ),
                  const Divider(height: 1),
                  _buildNavItem(
                    context,
                    icon: Icons.delete_outline,
                    title: 'Vider cache',
                    onTap: () => _clearCache(context),
                  ),
                  const Divider(height: 1),
                  _buildNavItem(
                    context,
                    icon: Icons.info_outline,
                    title: 'À propos',
                    onTap: () => _showAbout(context),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: AppTypography.body),
        Text(value, style: AppTypography.bodyMedium),
      ],
    );
  }

  Widget _buildNavItem(
    BuildContext context, {
    required IconData icon,
    required String title,
    required VoidCallback onTap,
  }) {
    return ListTile(
      leading: Icon(icon, color: AppColors.neutral600),
      title: Text(title, style: AppTypography.body),
      trailing: const Icon(Icons.chevron_right, color: AppColors.neutral400),
      onTap: onTap,
    );
  }

  void _logout(BuildContext context, AppState appState) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Déconnexion'),
        content: const Text('Voulez-vous vraiment vous déconnecter ?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Annuler'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              appState.logout();
              context.go(AppRoutes.login);
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            child: const Text('Déconnecter'),
          ),
        ],
      ),
    );
  }

  void _clearCache(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Vider le cache'),
        content: const Text('Cette action supprimera les données temporaires. Continuer ?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Annuler'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              // TODO: Implement cache clearing
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Cache vidé')),
              );
            },
            child: const Text('Vider'),
          ),
        ],
      ),
    );
  }

  void _showAbout(BuildContext context) {
    showAboutDialog(
      context: context,
      applicationName: 'Manchengo ERP',
      applicationVersion: '1.0.0',
      applicationLegalese: '© 2024 Manchengo SARL',
      children: [
        const SizedBox(height: 16),
        const Text('ERP industriel offline-first pour l\'agro-alimentaire.'),
      ],
    );
  }

  void _showNotImplemented(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Fonctionnalité non implémentée')),
    );
  }
}
