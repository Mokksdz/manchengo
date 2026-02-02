import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/app_state.dart';
import '../models/models.dart';
import '../theme/app_colors.dart';

/// Sync status indicator for app bar
class SyncIndicator extends StatelessWidget {
  const SyncIndicator({super.key});

  @override
  Widget build(BuildContext context) {
    final syncStatus = context.select<AppState, SyncStatus>((s) => s.syncStatus);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: _getBackgroundColor(syncStatus),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildIcon(syncStatus),
          const SizedBox(width: 4),
          Text(
            _getLabel(syncStatus),
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: _getTextColor(syncStatus),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildIcon(SyncStatus status) {
    switch (status) {
      case SyncStatus.synced:
        return const Icon(Icons.check_circle, size: 14, color: AppColors.success);
      case SyncStatus.syncing:
        return const SizedBox(
          width: 14,
          height: 14,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            valueColor: AlwaysStoppedAnimation(AppColors.info),
          ),
        );
      case SyncStatus.offline:
        return const Icon(Icons.wifi_off, size: 14, color: AppColors.offline);
      case SyncStatus.error:
        return const Icon(Icons.error, size: 14, color: AppColors.error);
    }
  }

  Color _getBackgroundColor(SyncStatus status) {
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

  Color _getTextColor(SyncStatus status) {
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

  String _getLabel(SyncStatus status) {
    switch (status) {
      case SyncStatus.synced:
        return 'En ligne';
      case SyncStatus.syncing:
        return 'Sync...';
      case SyncStatus.offline:
        return 'Hors ligne';
      case SyncStatus.error:
        return 'Erreur';
    }
  }
}
