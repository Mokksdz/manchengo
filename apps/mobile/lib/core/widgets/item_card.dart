import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';

/// Generic item card for lists
class ItemCard extends StatelessWidget {
  final String title;
  final String? subtitle;
  final String? trailing;
  final Widget? leadingIcon;
  final Widget? badge;
  final VoidCallback? onTap;
  final VoidCallback? onDelete;

  const ItemCard({
    super.key,
    required this.title,
    this.subtitle,
    this.trailing,
    this.leadingIcon,
    this.badge,
    this.onTap,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              if (leadingIcon != null) ...[
                leadingIcon!,
                const SizedBox(width: 12),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            title,
                            style: AppTypography.bodyMedium,
                          ),
                        ),
                        if (badge != null) badge!,
                      ],
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        subtitle!,
                        style: AppTypography.caption,
                      ),
                    ],
                  ],
                ),
              ),
              if (trailing != null) ...[
                const SizedBox(width: 12),
                Text(
                  trailing!,
                  style: AppTypography.bodyMedium.copyWith(
                    color: AppColors.neutral600,
                  ),
                ),
              ],
              if (onDelete != null) ...[
                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(Icons.close, size: 20),
                  onPressed: onDelete,
                  color: AppColors.neutral400,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
              ],
              if (onTap != null && onDelete == null)
                const Icon(
                  Icons.chevron_right,
                  color: AppColors.neutral400,
                ),
            ],
          ),
        ),
      ),
    );
  }
}
