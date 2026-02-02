import 'package:flutter/material.dart';
import '../models/models.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';

/// Status badge widget
class StatusBadge extends StatelessWidget {
  final String label;
  final Color backgroundColor;
  final Color textColor;
  final IconData? icon;

  const StatusBadge({
    super.key,
    required this.label,
    required this.backgroundColor,
    required this.textColor,
    this.icon,
  });

  factory StatusBadge.stock(StockStatus status) {
    switch (status) {
      case StockStatus.ok:
        return const StatusBadge(
          label: 'OK',
          backgroundColor: AppColors.successLight,
          textColor: AppColors.success,
          icon: Icons.check,
        );
      case StockStatus.low:
        return const StatusBadge(
          label: 'Bas',
          backgroundColor: AppColors.warningLight,
          textColor: AppColors.warning,
          icon: Icons.warning_amber,
        );
      case StockStatus.critical:
        return const StatusBadge(
          label: 'Critique',
          backgroundColor: AppColors.errorLight,
          textColor: AppColors.error,
          icon: Icons.error_outline,
        );
      case StockStatus.empty:
        return const StatusBadge(
          label: 'Rupture',
          backgroundColor: AppColors.neutral100,
          textColor: AppColors.neutral500,
          icon: Icons.remove,
        );
    }
  }

  factory StatusBadge.production(ProductionStatus status) {
    switch (status) {
      case ProductionStatus.planned:
        return const StatusBadge(
          label: 'Prévu',
          backgroundColor: AppColors.neutral100,
          textColor: AppColors.neutral600,
          icon: Icons.schedule,
        );
      case ProductionStatus.inProgress:
        return const StatusBadge(
          label: 'En cours',
          backgroundColor: AppColors.infoLight,
          textColor: AppColors.info,
          icon: Icons.play_circle_outline,
        );
      case ProductionStatus.completed:
        return const StatusBadge(
          label: 'Terminé',
          backgroundColor: AppColors.successLight,
          textColor: AppColors.success,
          icon: Icons.check_circle_outline,
        );
    }
  }

  factory StatusBadge.invoice(InvoiceStatus status) {
    switch (status) {
      case InvoiceStatus.unpaid:
        return const StatusBadge(
          label: 'Impayée',
          backgroundColor: AppColors.errorLight,
          textColor: AppColors.error,
          icon: Icons.cancel_outlined,
        );
      case InvoiceStatus.partial:
        return const StatusBadge(
          label: 'Partielle',
          backgroundColor: AppColors.warningLight,
          textColor: AppColors.warning,
          icon: Icons.timelapse,
        );
      case InvoiceStatus.paid:
        return const StatusBadge(
          label: 'Payée',
          backgroundColor: AppColors.successLight,
          textColor: AppColors.success,
          icon: Icons.check_circle,
        );
    }
  }

  factory StatusBadge.role(UserRole role) {
    Color bg;
    switch (role) {
      case UserRole.admin:
        bg = AppColors.brandBlue;
        break;
      case UserRole.appro:
        bg = AppColors.domainMp;
        break;
      case UserRole.production:
        bg = AppColors.domainProduction;
        break;
      case UserRole.commercial:
        bg = AppColors.domainPf;
        break;
      case UserRole.comptable:
        bg = AppColors.neutral600;
        break;
    }
    return StatusBadge(
      label: role.label,
      backgroundColor: bg,
      textColor: AppColors.white,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: textColor),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: AppTypography.small.copyWith(
              color: textColor,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
