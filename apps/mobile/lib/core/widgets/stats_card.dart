import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';

/// Stats card for dashboard
class StatsCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color? iconColor;
  final VoidCallback? onTap;

  const StatsCard({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    this.iconColor,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                size: 28,
                color: iconColor ?? AppColors.brandGold,
              ),
              const SizedBox(height: 8),
              Text(
                label,
                style: AppTypography.caption,
              ),
              const SizedBox(height: 4),
              Text(
                value,
                style: AppTypography.h2.copyWith(
                  color: AppColors.neutral800,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
