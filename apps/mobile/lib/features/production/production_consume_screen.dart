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
import '../../core/qr/qr.dart';
import '../../core/services/services.dart';
import '../qr/qr_scanner_helper.dart';

/// Production - Consume MP screen
class ProductionConsumeScreen extends StatefulWidget {
  const ProductionConsumeScreen({super.key});

  @override
  State<ProductionConsumeScreen> createState() => _ProductionConsumeScreenState();
}

class _ProductionConsumeScreenState extends State<ProductionConsumeScreen> {
  ProductionOrder? _selectedOrder;
  final List<_ConsumptionItem> _consumptions = [];
  bool _isLoading = false;

  void _selectOrder() async {
    final appState = context.read<AppState>();
    final activeOrders = appState.productionOrders
        .where((o) => o.status != ProductionStatus.completed)
        .toList();
    
    final order = await showModalBottomSheet<ProductionOrder>(
      context: context,
      builder: (context) => _OrderPicker(orders: activeOrders),
    );
    if (order != null) {
      setState(() {
        _selectedOrder = order;
        _consumptions.clear();
        // Pre-fill existing consumptions
        for (final c in order.consumptions) {
          _consumptions.add(_ConsumptionItem(
            lotNumber: c.lotNumber,
            productName: c.productName,
            available: 200, // TODO: Get from real data
            quantity: c.quantity,
            unit: c.unit,
          ));
        }
      });
    }
  }

  void _scanLot() async {
    // Scan QR for MP lot
    final payload = await scanQrForType(context, QrEntityType.mp);
    if (payload == null) return;

    // Resolve lot from QR shortId
    try {
      final resolver = QrResolverService();
      final resolved = await resolver.resolveLotMp(payload.shortId);

      // Check if lot already added
      if (_consumptions.any((c) => c.lotNumber == resolved.lot.lotNumber)) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Ce lot est déjà dans la liste')),
          );
        }
        return;
      }

      // Check lot has stock
      if (resolved.lot.quantity <= 0) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Ce lot n\'a plus de stock disponible'),
              backgroundColor: AppColors.error,
            ),
          );
        }
        return;
      }

      setState(() {
        _consumptions.add(_ConsumptionItem(
          lotId: resolved.lot.id,
          lotNumber: resolved.lot.lotNumber,
          productName: resolved.productName,
          available: resolved.lot.quantity,
          quantity: 0,
          unit: resolved.unit,
        ));
      });
    } on EntityNotFoundError catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: AppColors.error),
        );
      }
    }
  }

  void _removeConsumption(int index) {
    setState(() => _consumptions.removeAt(index));
  }

  void _updateQuantity(int index, int quantity) {
    setState(() => _consumptions[index].quantity = quantity);
  }

  bool get _hasStockError {
    return _consumptions.any((c) => c.quantity > c.available);
  }

  Future<void> _confirm() async {
    if (_selectedOrder == null || _consumptions.isEmpty || _hasStockError) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Veuillez corriger les erreurs')),
      );
      return;
    }

    setState(() => _isLoading = true);

    // TODO: Implement real consumption
    await Future.delayed(const Duration(seconds: 1));

    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Consommation enregistrée'),
        backgroundColor: AppColors.success,
      ),
    );

    // Navigate to finish screen
    context.pushReplacement(AppRoutes.productionFinish);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Consommer MP'),
        actions: const [
          Padding(
            padding: EdgeInsets.only(right: 16),
            child: SyncIndicator(),
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
                  // Order selection
                  Text('Ordre de production', style: AppTypography.label),
                  const SizedBox(height: 8),
                  InkWell(
                    onTap: _selectOrder,
                    child: Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: _selectedOrder != null
                            ? Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Text(
                                        _selectedOrder!.reference,
                                        style: AppTypography.bodyMedium,
                                      ),
                                      const Spacer(),
                                      StatusBadge.production(_selectedOrder!.status),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    _selectedOrder!.productName,
                                    style: AppTypography.caption,
                                  ),
                                ],
                              )
                            : Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      'Sélectionner un ordre',
                                      style: AppTypography.body.copyWith(color: AppColors.neutral400),
                                    ),
                                  ),
                                  const Icon(Icons.search, color: AppColors.neutral400),
                                ],
                              ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Scan button
                  Card(
                    color: AppColors.brandGoldLight,
                    child: InkWell(
                      onTap: _scanLot,
                      borderRadius: BorderRadius.circular(12),
                      child: Padding(
                        padding: const EdgeInsets.all(20),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.qr_code_scanner, color: AppColors.brandGold),
                            const SizedBox(width: 8),
                            Text(
                              'Scanner lot MP',
                              style: AppTypography.bodyMedium.copyWith(color: AppColors.brandGold),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Lots section
                  const SectionHeader(title: 'LOTS SCANNÉS'),

                  if (_consumptions.isEmpty)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Center(
                          child: Text(
                            'Aucun lot scanné',
                            style: AppTypography.caption,
                          ),
                        ),
                      ),
                    )
                  else
                    ..._consumptions.asMap().entries.map((entry) {
                      final index = entry.key;
                      final item = entry.value;
                      final hasError = item.quantity > item.available;
                      
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Card(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      width: 8,
                                      height: 8,
                                      decoration: BoxDecoration(
                                        color: hasError ? AppColors.error : AppColors.success,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        '${item.productName} - ${item.lotNumber}',
                                        style: AppTypography.bodyMedium,
                                      ),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.close, size: 20),
                                      onPressed: () => _removeConsumption(index),
                                      color: AppColors.neutral400,
                                      padding: EdgeInsets.zero,
                                      constraints: const BoxConstraints(),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Disponible: ${item.available} ${item.unit}',
                                  style: AppTypography.caption,
                                ),
                                const SizedBox(height: 12),
                                Row(
                                  children: [
                                    Text('À utiliser:', style: AppTypography.caption),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: TextField(
                                        keyboardType: TextInputType.number,
                                        decoration: InputDecoration(
                                          suffixText: item.unit,
                                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                          errorText: hasError ? 'Stock insuffisant' : null,
                                        ),
                                        controller: TextEditingController(text: '${item.quantity}'),
                                        onChanged: (value) {
                                          final qty = int.tryParse(value) ?? 0;
                                          _updateQuantity(index, qty);
                                        },
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    }),

                  const SizedBox(height: 16),

                  // Info banner
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.infoLight,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.info_outline, color: AppColors.info, size: 20),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Stock calculé automatiquement (FIFO)',
                            style: AppTypography.caption.copyWith(color: AppColors.info),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Error banner
          if (_hasStockError)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              color: AppColors.errorLight,
              child: Row(
                children: [
                  Icon(Icons.warning, color: AppColors.error, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Stock insuffisant pour certains lots',
                      style: AppTypography.caption.copyWith(color: AppColors.error),
                    ),
                  ),
                ],
              ),
            ),

          // Bottom CTA
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
                onPressed: (_isLoading || _hasStockError) ? null : _confirm,
                icon: _isLoading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.check),
                label: const Text('CONFIRMER CONSOMMATION'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ConsumptionItem {
  final String? lotId;
  final String lotNumber;
  final String productName;
  final int available;
  int quantity;
  final String unit;

  _ConsumptionItem({
    this.lotId,
    required this.lotNumber,
    required this.productName,
    required this.available,
    required this.quantity,
    required this.unit,
  });
}

class _OrderPicker extends StatelessWidget {
  final List<ProductionOrder> orders;

  const _OrderPicker({required this.orders});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Sélectionner ordre', style: AppTypography.h2),
          const SizedBox(height: 16),
          if (orders.isEmpty)
            Padding(
              padding: const EdgeInsets.all(24),
              child: Center(
                child: Text('Aucun ordre actif', style: AppTypography.caption),
              ),
            )
          else
            ...orders.map((o) => ListTile(
              title: Text(o.reference),
              subtitle: Text(o.productName),
              trailing: StatusBadge.production(o.status),
              onTap: () => Navigator.pop(context, o),
            )),
        ],
      ),
    );
  }
}
