import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../core/state/app_state.dart';
import '../../core/models/models.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/widgets/sync_indicator.dart';
import '../../core/widgets/section_header.dart';

/// Sync status screen
class SyncScreen extends StatelessWidget {
  const SyncScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    final pending = appState.pendingSyncItems;
    final errors = appState.errorSyncItems;
    final timeFormat = DateFormat('HH:mm');

    return Scaffold(
      appBar: AppBar(
        title: const Text('Synchronisation'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: _buildStatusDot(appState.syncStatus),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Connection status card
                  Card(
                    color: _getStatusCardColor(appState.syncStatus),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          Icon(
                            _getStatusIcon(appState.syncStatus),
                            color: _getStatusColor(appState.syncStatus),
                            size: 24,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _getStatusText(appState.syncStatus),
                                  style: AppTypography.bodyMedium.copyWith(
                                    color: _getStatusColor(appState.syncStatus),
                                  ),
                                ),
                                if (appState.lastSync != null)
                                  Text(
                                    'Dernière sync: ${timeFormat.format(appState.lastSync!)}',
                                    style: AppTypography.caption,
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Pending items
                  SectionHeader(title: 'EN ATTENTE (${pending.length})'),
                  if (pending.isEmpty)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Center(
                          child: Column(
                            children: [
                              Icon(
                                Icons.check_circle_outline,
                                size: 32,
                                color: AppColors.success,
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'Tout est synchronisé',
                                style: AppTypography.body.copyWith(color: AppColors.success),
                              ),
                            ],
                          ),
                        ),
                      ),
                    )
                  else
                    ...pending.map((item) => _buildSyncItem(
                      item,
                      icon: Icons.schedule,
                      iconColor: AppColors.info,
                      backgroundColor: AppColors.infoLight,
                    )),
                  const SizedBox(height: 24),

                  // Error items
                  if (errors.isNotEmpty) ...[
                    SectionHeader(title: 'ERREURS (${errors.length})'),
                    ...errors.map((item) => _buildSyncItem(
                      item,
                      icon: Icons.error_outline,
                      iconColor: AppColors.error,
                      backgroundColor: AppColors.errorLight,
                      showResolve: true,
                    )),
                  ],
                ],
              ),
            ),
          ),

          // Force sync button
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.1),
                  blurRadius: 8,
                  offset: const Offset(0, -2),
                ),
              ],
            ),
            child: SafeArea(
              child: ElevatedButton.icon(
                onPressed: appState.syncStatus == SyncStatus.syncing
                    ? null
                    : () => appState.forceSync(),
                icon: appState.syncStatus == SyncStatus.syncing
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.sync),
                label: const Text('FORCER SYNCHRONISATION'),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusDot(SyncStatus status) {
    return Container(
      width: 12,
      height: 12,
      decoration: BoxDecoration(
        color: _getStatusColor(status),
        shape: BoxShape.circle,
      ),
    );
  }

  Widget _buildSyncItem(
    SyncQueueItem item, {
    required IconData icon,
    required Color iconColor,
    required Color backgroundColor,
    bool showResolve = false,
  }) {
    final timeFormat = DateFormat('HH:mm');
    
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: backgroundColor,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 18, color: iconColor),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${item.type} ${item.reference}',
                    style: AppTypography.bodyMedium,
                  ),
                  Text(
                    item.hasError
                        ? item.errorMessage ?? 'Erreur inconnue'
                        : 'Créée hors ligne à ${timeFormat.format(item.createdAt)}',
                    style: AppTypography.caption.copyWith(
                      color: item.hasError ? AppColors.error : null,
                    ),
                  ),
                ],
              ),
            ),
            if (showResolve)
              TextButton(
                onPressed: () {
                  // TODO: Implement conflict resolution
                },
                child: const Text('Résoudre'),
              ),
          ],
        ),
      ),
    );
  }

  Color _getStatusCardColor(SyncStatus status) {
    switch (status) {
      case SyncStatus.synced:
        return AppColors.successLight;
      case SyncStatus.syncing:
        return AppColors.infoLight;
      case SyncStatus.offline:
        return AppColors.offlineLight;
      case SyncStatus.error:
        return AppColors.errorLight;
    }
  }

  Color _getStatusColor(SyncStatus status) {
    switch (status) {
      case SyncStatus.synced:
        return AppColors.success;
      case SyncStatus.syncing:
        return AppColors.info;
      case SyncStatus.offline:
        return AppColors.offline;
      case SyncStatus.error:
        return AppColors.error;
    }
  }

  IconData _getStatusIcon(SyncStatus status) {
    switch (status) {
      case SyncStatus.synced:
        return Icons.check_circle;
      case SyncStatus.syncing:
        return Icons.sync;
      case SyncStatus.offline:
        return Icons.wifi_off;
      case SyncStatus.error:
        return Icons.error;
    }
  }

  String _getStatusText(SyncStatus status) {
    switch (status) {
      case SyncStatus.synced:
        return 'Connecté au serveur';
      case SyncStatus.syncing:
        return 'Synchronisation en cours...';
      case SyncStatus.offline:
        return 'Mode hors-ligne';
      case SyncStatus.error:
        return 'Erreur de connexion';
    }
  }
}
