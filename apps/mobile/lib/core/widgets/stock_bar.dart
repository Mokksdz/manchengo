import 'package:flutter/material.dart';
import '../models/models.dart';
import '../theme/app_colors.dart';

/// Visual stock level bar
class StockBar extends StatelessWidget {
  final int current;
  final int min;
  final StockStatus? status;

  const StockBar({
    super.key,
    required this.current,
    required this.min,
    this.status,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveStatus = status ?? _calculateStatus();
    final ratio = min > 0 ? (current / min).clamp(0.0, 1.0) : 1.0;

    return Container(
      height: 8,
      decoration: BoxDecoration(
        color: AppColors.neutral200,
        borderRadius: BorderRadius.circular(4),
      ),
      child: FractionallySizedBox(
        alignment: Alignment.centerLeft,
        widthFactor: ratio,
        child: Container(
          decoration: BoxDecoration(
            color: _getColor(effectiveStatus),
            borderRadius: BorderRadius.circular(4),
          ),
        ),
      ),
    );
  }

  StockStatus _calculateStatus() {
    if (current == 0) return StockStatus.empty;
    if (min == 0) return StockStatus.ok;
    final ratio = current / min;
    if (ratio < 0.2) return StockStatus.critical;
    if (ratio < 0.5) return StockStatus.low;
    return StockStatus.ok;
  }

  Color _getColor(StockStatus status) {
    switch (status) {
      case StockStatus.ok:
        return AppColors.success;
      case StockStatus.low:
        return AppColors.warning;
      case StockStatus.critical:
        return AppColors.error;
      case StockStatus.empty:
        return AppColors.neutral400;
    }
  }
}
