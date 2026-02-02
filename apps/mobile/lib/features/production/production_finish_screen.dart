import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../core/state/app_state.dart';
import '../../core/models/models.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/widgets/sync_indicator.dart';
import '../../core/widgets/status_badge.dart';
import '../../core/widgets/section_header.dart';
import '../../core/qr/qr.dart';
import '../../core/services/services.dart';
import '../qr/qr_scanner_helper.dart';

/// Production - Finish PF screen
class ProductionFinishScreen extends StatefulWidget {
  const ProductionFinishScreen({super.key});

  @override
  State<ProductionFinishScreen> createState() => _ProductionFinishScreenState();
}

class _ProductionFinishScreenState extends State<ProductionFinishScreen> {
  ProductionOrder? _selectedOrder;
  final _quantityController = TextEditingController();
  DateTime _productionDate = DateTime.now();
  bool _printLabels = true;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    // Pre-select first in-progress order
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final appState = context.read<AppState>();
      final inProgressOrders = appState.productionOrders
          .where((o) => o.status == ProductionStatus.inProgress)
          .toList();
      if (inProgressOrders.isNotEmpty) {
        setState(() {
          _selectedOrder = inProgressOrders.first;
          _quantityController.text = '${_selectedOrder!.plannedQuantity}';
        });
      }
    });
  }

  /// Scan QR to select production order
  void _scanOrder() async {
    final payload = await scanQrForType(context, QrEntityType.prod);
    if (payload == null) return;

    try {
      final resolver = QrResolverService();
      final order = await resolver.resolveProductionOrder(payload.shortId);

      setState(() {
        _selectedOrder = order;
        _quantityController.text = '${order.plannedQuantity}';
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Ordre ${order.reference} sélectionné'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } on EntityNotFoundError catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: AppColors.error),
        );
      }
    } on ValidationError catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: AppColors.error),
        );
      }
    }
  }

  @override
  void dispose() {
    _quantityController.dispose();
    super.dispose();
  }

  void _selectDate() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _productionDate,
      firstDate: DateTime.now().subtract(const Duration(days: 7)),
      lastDate: DateTime.now(),
    );
    if (date != null) {
      setState(() => _productionDate = date);
    }
  }

  Future<void> _finish() async {
    if (_selectedOrder == null || _quantityController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Veuillez remplir tous les champs')),
      );
      return;
    }

    setState(() => _isLoading = true);

    // TODO: Implement real production finish
    await Future.delayed(const Duration(seconds: 1));

    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Production terminée avec succès'),
        backgroundColor: AppColors.success,
      ),
    );

    if (_printLabels) {
      // TODO: Implement label printing
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Impression des étiquettes...')),
      );
    }

    context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('dd/MM/yyyy');

    return Scaffold(
      appBar: AppBar(
        title: const Text('Finaliser Production'),
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
                  // Order info
                  if (_selectedOrder != null) ...[
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  'Ordre: ${_selectedOrder!.reference}',
                                  style: AppTypography.bodyMedium,
                                ),
                                const Spacer(),
                                StatusBadge.production(_selectedOrder!.status),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Produit: ${_selectedOrder!.productName}',
                              style: AppTypography.body,
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // MP consumed section
                    const SectionHeader(title: 'MP CONSOMMÉES'),
                    Card(
                      child: Column(
                        children: _selectedOrder!.consumptions.isEmpty
                            ? [
                                Padding(
                                  padding: const EdgeInsets.all(16),
                                  child: Text(
                                    'Aucune MP consommée',
                                    style: AppTypography.caption,
                                  ),
                                ),
                              ]
                            : _selectedOrder!.consumptions.map((c) {
                                return ListTile(
                                  leading: const Icon(Icons.check_circle, color: AppColors.success, size: 20),
                                  title: Text(c.productName, style: AppTypography.body),
                                  trailing: Text(
                                    '${c.quantity} ${c.unit}',
                                    style: AppTypography.bodyMedium,
                                  ),
                                );
                              }).toList(),
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],

                  // Production finale section
                  const SectionHeader(title: 'PRODUCTION FINALE'),
                  
                  // Quantity
                  Text('Quantité produite *', style: AppTypography.label),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _quantityController,
                    keyboardType: TextInputType.number,
                    textAlign: TextAlign.center,
                    style: AppTypography.h1,
                    decoration: const InputDecoration(
                      suffixText: 'unités',
                      contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 20),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Date
                  Text('Date de production', style: AppTypography.label),
                  const SizedBox(height: 8),
                  InkWell(
                    onTap: _selectDate,
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.white,
                        border: Border.all(color: AppColors.neutral300),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              dateFormat.format(_productionDate),
                              style: AppTypography.body,
                            ),
                          ),
                          const Icon(Icons.calendar_today, color: AppColors.neutral400),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Print labels checkbox
                  Card(
                    child: CheckboxListTile(
                      value: _printLabels,
                      onChanged: (value) => setState(() => _printLabels = value ?? true),
                      title: Text('Imprimer étiquettes QR', style: AppTypography.body),
                      controlAffinity: ListTileControlAffinity.leading,
                      activeColor: AppColors.brandGold,
                    ),
                  ),
                ],
              ),
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
                onPressed: _isLoading ? null : _finish,
                icon: _isLoading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.check),
                label: const Text('TERMINER PRODUCTION'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
