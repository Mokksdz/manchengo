import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/state/app_state.dart';
import '../../core/models/models.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/widgets/sync_indicator.dart';
import '../../core/widgets/section_header.dart';
import '../../core/widgets/item_card.dart';

/// MP Reception screen
class ReceptionScreen extends StatefulWidget {
  const ReceptionScreen({super.key});

  @override
  State<ReceptionScreen> createState() => _ReceptionScreenState();
}

class _ReceptionScreenState extends State<ReceptionScreen> {
  Supplier? _selectedSupplier;
  final _blController = TextEditingController();
  final List<_ReceptionLineItem> _lines = [];
  bool _isLoading = false;

  @override
  void dispose() {
    _blController.dispose();
    super.dispose();
  }

  void _selectSupplier() async {
    final appState = context.read<AppState>();
    final supplier = await showModalBottomSheet<Supplier>(
      context: context,
      builder: (context) => _SupplierPicker(suppliers: appState.suppliers),
    );
    if (supplier != null) {
      setState(() => _selectedSupplier = supplier);
    }
  }

  void _addProduct() async {
    final appState = context.read<AppState>();
    final product = await showModalBottomSheet<Product>(
      context: context,
      builder: (context) => _ProductPicker(products: appState.productsMp),
    );
    if (product != null) {
      setState(() {
        _lines.add(_ReceptionLineItem(product: product, quantity: 1));
      });
    }
  }

  void _removeLine(int index) {
    setState(() => _lines.removeAt(index));
  }

  void _updateQuantity(int index, int quantity) {
    setState(() => _lines[index].quantity = quantity);
  }

  Future<void> _validate() async {
    if (_selectedSupplier == null || _blController.text.isEmpty || _lines.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Veuillez remplir tous les champs')),
      );
      return;
    }

    setState(() => _isLoading = true);

    // TODO: Implement real reception creation
    await Future.delayed(const Duration(seconds: 1));

    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Réception validée avec succès'),
        backgroundColor: AppColors.success,
      ),
    );

    context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final totalQuantity = _lines.fold<int>(0, (sum, l) => sum + l.quantity);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Nouvelle Réception'),
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
                  // Supplier selection
                  Text('Fournisseur *', style: AppTypography.label),
                  const SizedBox(height: 8),
                  InkWell(
                    onTap: _selectSupplier,
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
                              _selectedSupplier?.name ?? 'Rechercher ou scanner',
                              style: _selectedSupplier != null
                                  ? AppTypography.body
                                  : AppTypography.body.copyWith(color: AppColors.neutral400),
                            ),
                          ),
                          const Icon(Icons.search, color: AppColors.neutral400),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // BL Number
                  Text('N° BL Fournisseur *', style: AppTypography.label),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _blController,
                    decoration: const InputDecoration(
                      hintText: 'Ex: BL-2024-1234',
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Articles section
                  const SectionHeader(title: 'ARTICLES'),
                  
                  if (_lines.isEmpty)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Center(
                          child: Text(
                            'Aucun article ajouté',
                            style: AppTypography.caption,
                          ),
                        ),
                      ),
                    )
                  else
                    ..._lines.asMap().entries.map((entry) {
                      final index = entry.key;
                      final line = entry.value;
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
                                    Expanded(
                                      child: Text(
                                        line.product.name,
                                        style: AppTypography.bodyMedium,
                                      ),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.close, size: 20),
                                      onPressed: () => _removeLine(index),
                                      color: AppColors.neutral400,
                                      padding: EdgeInsets.zero,
                                      constraints: const BoxConstraints(),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                Row(
                                  children: [
                                    Text('Quantité:', style: AppTypography.caption),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: TextField(
                                        keyboardType: TextInputType.number,
                                        decoration: InputDecoration(
                                          suffixText: line.product.unit,
                                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                        ),
                                        controller: TextEditingController(text: '${line.quantity}'),
                                        onChanged: (value) {
                                          final qty = int.tryParse(value) ?? 1;
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

                  const SizedBox(height: 8),
                  
                  // Add button
                  OutlinedButton.icon(
                    onPressed: _addProduct,
                    icon: const Icon(Icons.add),
                    label: const Text('Ajouter article'),
                  ),
                  const SizedBox(height: 24),

                  // Summary
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.neutral100,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Articles: ${_lines.length}', style: AppTypography.body),
                        Text('Total: $totalQuantity', style: AppTypography.bodyMedium),
                      ],
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
                onPressed: _isLoading ? null : _validate,
                icon: _isLoading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.check),
                label: const Text('VALIDER RÉCEPTION'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReceptionLineItem {
  final Product product;
  int quantity;

  _ReceptionLineItem({required this.product, required this.quantity});
}

class _SupplierPicker extends StatelessWidget {
  final List<Supplier> suppliers;

  const _SupplierPicker({required this.suppliers});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Sélectionner fournisseur', style: AppTypography.h2),
          const SizedBox(height: 16),
          ...suppliers.map((s) => ListTile(
            title: Text(s.name),
            subtitle: Text(s.code),
            onTap: () => Navigator.pop(context, s),
          )),
        ],
      ),
    );
  }
}

class _ProductPicker extends StatelessWidget {
  final List<Product> products;

  const _ProductPicker({required this.products});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Sélectionner produit MP', style: AppTypography.h2),
          const SizedBox(height: 16),
          ...products.map((p) => ListTile(
            title: Text(p.name),
            subtitle: Text('${p.code} • ${p.unit}'),
            onTap: () => Navigator.pop(context, p),
          )),
        ],
      ),
    );
  }
}
