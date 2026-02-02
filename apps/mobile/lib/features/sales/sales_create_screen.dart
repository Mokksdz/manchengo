import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../core/state/app_state.dart';
import '../../core/models/models.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/navigation/app_router.dart';
import '../../core/widgets/sync_indicator.dart';
import '../../core/widgets/section_header.dart';
import '../../core/qr/qr.dart';
import '../../core/services/services.dart';
import '../qr/qr_scanner_helper.dart';

/// Sales - Create sale screen
class SalesCreateScreen extends StatefulWidget {
  const SalesCreateScreen({super.key});

  @override
  State<SalesCreateScreen> createState() => _SalesCreateScreenState();
}

class _SalesCreateScreenState extends State<SalesCreateScreen> {
  Client? _selectedClient;
  final List<_SalesLineItem> _lines = [];
  bool _isLoading = false;

  final _currencyFormat = NumberFormat.currency(
    locale: 'fr_DZ',
    symbol: 'DA',
    decimalDigits: 2,
  );

  int get _totalHt => _lines.fold(0, (sum, l) => sum + l.lineHt);
  int get _totalTva => (_totalHt * 0.19).round();
  int get _totalTtc => _totalHt + _totalTva;

  void _selectClient() async {
    final appState = context.read<AppState>();
    final client = await showModalBottomSheet<Client>(
      context: context,
      builder: (context) => _ClientPicker(clients: appState.clients),
    );
    if (client != null) {
      setState(() => _selectedClient = client);
    }
  }

  void _addProduct() async {
    final appState = context.read<AppState>();
    final product = await showModalBottomSheet<Product>(
      context: context,
      builder: (context) => _ProductPicker(products: appState.productsPf),
    );
    if (product != null) {
      _addOrIncrementProduct(product);
    }
  }

  /// Scan QR to add PF product to sale
  void _scanProduct() async {
    final payload = await scanQrForType(context, QrEntityType.pf);
    if (payload == null) return;

    try {
      final resolver = QrResolverService();
      final resolved = await resolver.resolveLotPf(payload.shortId);

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

      _addOrIncrementProduct(resolved.product);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${resolved.product.name} ajouté (lot ${resolved.lot.lotNumber})'),
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
    }
  }

  /// Add product to lines or increment quantity if already present
  void _addOrIncrementProduct(Product product) {
    setState(() {
      // Check if product already in lines
      final existingIndex = _lines.indexWhere((l) => l.product.id == product.id);
      if (existingIndex >= 0) {
        // Increment quantity (respecting stock limit)
        final existing = _lines[existingIndex];
        if (existing.quantity < existing.product.currentStock) {
          existing.quantity++;
        }
      } else {
        // Add new line
        _lines.add(_SalesLineItem(
          product: product,
          quantity: 1,
          unitPriceHt: product.priceHt,
        ));
      }
    });
  }

  void _removeLine(int index) {
    setState(() => _lines.removeAt(index));
  }

  void _updateQuantity(int index, int quantity) {
    setState(() {
      _lines[index].quantity = quantity.clamp(1, _lines[index].product.currentStock);
    });
  }

  bool get _hasStockError {
    return _lines.any((l) => l.quantity > l.product.currentStock);
  }

  Future<void> _createSale() async {
    if (_selectedClient == null || _lines.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Veuillez remplir tous les champs')),
      );
      return;
    }

    setState(() => _isLoading = true);

    // TODO: Implement real sale creation
    await Future.delayed(const Duration(seconds: 1));

    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Vente créée avec succès'),
        backgroundColor: AppColors.success,
      ),
    );

    // Navigate to invoice detail
    context.pushReplacement('${AppRoutes.invoiceDetail.replaceFirst(':id', 'inv1')}');
  }

  String _formatPrice(int centimes) {
    return _currencyFormat.format(centimes / 100);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Nouvelle Vente'),
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
                  // Client selection
                  Text('Client *', style: AppTypography.label),
                  const SizedBox(height: 8),
                  InkWell(
                    onTap: _selectClient,
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.white,
                        border: Border.all(color: AppColors.neutral300),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  _selectedClient?.name ?? 'Rechercher client',
                                  style: _selectedClient != null
                                      ? AppTypography.body
                                      : AppTypography.body.copyWith(color: AppColors.neutral400),
                                ),
                              ),
                              const Icon(Icons.search, color: AppColors.neutral400),
                            ],
                          ),
                          if (_selectedClient != null) ...[
                            const SizedBox(height: 4),
                            Text(
                              'Type: ${_selectedClient!.type}',
                              style: AppTypography.caption,
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Scan PF button
                  Card(
                    color: AppColors.brandGoldLight,
                    child: InkWell(
                      onTap: _scanProduct,
                      borderRadius: BorderRadius.circular(12),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.qr_code_scanner, color: AppColors.brandGold),
                            const SizedBox(width: 8),
                            Text(
                              'Scanner produit PF',
                              style: AppTypography.bodyMedium.copyWith(color: AppColors.brandGold),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

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
                      final hasError = line.quantity > line.product.currentStock;
                      
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
                                Text(
                                  _formatPrice(line.unitPriceHt) + '/u',
                                  style: AppTypography.caption,
                                ),
                                const SizedBox(height: 12),
                                Row(
                                  children: [
                                    // Quantity controls
                                    IconButton(
                                      icon: const Icon(Icons.remove_circle_outline),
                                      onPressed: line.quantity > 1
                                          ? () => _updateQuantity(index, line.quantity - 1)
                                          : null,
                                      color: AppColors.brandGold,
                                    ),
                                    Text(
                                      '${line.quantity}',
                                      style: AppTypography.h3,
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.add_circle_outline),
                                      onPressed: line.quantity < line.product.currentStock
                                          ? () => _updateQuantity(index, line.quantity + 1)
                                          : null,
                                      color: AppColors.brandGold,
                                    ),
                                    const Spacer(),
                                    Text(
                                      _formatPrice(line.lineHt),
                                      style: AppTypography.bodyMedium,
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    Icon(
                                      hasError ? Icons.warning : Icons.check_circle,
                                      size: 14,
                                      color: hasError ? AppColors.error : AppColors.success,
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      'Stock: ${line.product.currentStock} dispo',
                                      style: AppTypography.small.copyWith(
                                        color: hasError ? AppColors.error : AppColors.success,
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
                    label: const Text('Ajouter produit'),
                  ),
                  const SizedBox(height: 24),

                  // Totals
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        children: [
                          _buildTotalRow('Sous-total HT:', _formatPrice(_totalHt)),
                          const SizedBox(height: 8),
                          _buildTotalRow('TVA (19%):', _formatPrice(_totalTva)),
                          const Divider(height: 24),
                          _buildTotalRow(
                            'Total TTC:',
                            _formatPrice(_totalTtc),
                            isBold: true,
                          ),
                        ],
                      ),
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
                onPressed: (_isLoading || _hasStockError) ? null : _createSale,
                icon: _isLoading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.check),
                label: const Text('CRÉER VENTE'),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTotalRow(String label, String value, {bool isBold = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: isBold ? AppTypography.bodyMedium : AppTypography.body),
        Text(value, style: isBold ? AppTypography.h3 : AppTypography.bodyMedium),
      ],
    );
  }
}

class _SalesLineItem {
  final Product product;
  int quantity;
  final int unitPriceHt;

  _SalesLineItem({
    required this.product,
    required this.quantity,
    required this.unitPriceHt,
  });

  int get lineHt => quantity * unitPriceHt;
}

class _ClientPicker extends StatelessWidget {
  final List<Client> clients;

  const _ClientPicker({required this.clients});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Sélectionner client', style: AppTypography.h2),
          const SizedBox(height: 16),
          ...clients.map((c) => ListTile(
            title: Text(c.name),
            subtitle: Text('${c.code} • ${c.type}'),
            onTap: () => Navigator.pop(context, c),
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
    final currencyFormat = NumberFormat.currency(
      locale: 'fr_DZ',
      symbol: 'DA',
      decimalDigits: 2,
    );

    return Container(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Sélectionner produit', style: AppTypography.h2),
          const SizedBox(height: 16),
          ...products.map((p) => ListTile(
            title: Text(p.name),
            subtitle: Text('${currencyFormat.format(p.priceHt / 100)} • Stock: ${p.currentStock}'),
            enabled: p.currentStock > 0,
            onTap: p.currentStock > 0 ? () => Navigator.pop(context, p) : null,
          )),
        ],
      ),
    );
  }
}
