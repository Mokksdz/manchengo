import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../core/state/app_state.dart';
import '../../core/models/models.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/widgets/sync_indicator.dart';
import '../../core/widgets/stock_bar.dart';
import '../../core/widgets/status_badge.dart';

/// Stock PF screen
class StockPfScreen extends StatefulWidget {
  const StockPfScreen({super.key});

  @override
  State<StockPfScreen> createState() => _StockPfScreenState();
}

class _StockPfScreenState extends State<StockPfScreen> {
  String _searchQuery = '';

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    final products = appState.productsPf
        .where((p) => p.name.toLowerCase().contains(_searchQuery.toLowerCase()))
        .toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Stock Produits Finis'),
        actions: const [
          Padding(
            padding: EdgeInsets.only(right: 16),
            child: SyncIndicator(),
          ),
        ],
      ),
      body: Column(
        children: [
          // Search bar
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Rechercher produit...',
                prefixIcon: const Icon(Icons.search),
                filled: true,
                fillColor: AppColors.white,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide.none,
                ),
              ),
              onChanged: (value) => setState(() => _searchQuery = value),
            ),
          ),

          // Product list
          Expanded(
            child: products.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.inventory_2_outlined,
                          size: 48,
                          color: AppColors.neutral300,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'Aucun produit trouvé',
                          style: AppTypography.body.copyWith(color: AppColors.neutral400),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: products.length,
                    itemBuilder: (context, index) {
                      final product = products[index];
                      return _ProductCard(product: product);
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

class _ProductCard extends StatelessWidget {
  final Product product;

  const _ProductCard({required this.product});

  @override
  Widget build(BuildContext context) {
    final appState = context.read<AppState>();
    final lots = appState.lotsPf
        .where((l) => l.productId == product.id)
        .toList();
    
    final lastProdDate = lots.isNotEmpty
        ? lots.map((l) => l.productionDate).reduce((a, b) => a.isAfter(b) ? a : b)
        : null;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () => _showDetails(context, lots),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: AppColors.brandGoldLight,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(
                      Icons.local_dining,
                      color: AppColors.brandGold,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(product.name, style: AppTypography.bodyMedium),
                        Text(product.code, style: AppTypography.caption),
                      ],
                    ),
                  ),
                  StatusBadge.stock(product.stockStatus),
                ],
              ),
              const SizedBox(height: 12),
              StockBar(
                current: product.currentStock,
                min: product.minStock,
                status: product.stockStatus,
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '${product.currentStock} ${product.unit}s',
                    style: AppTypography.bodyMedium,
                  ),
                  if (lastProdDate != null)
                    Text(
                      'Dernière prod: ${DateFormat('dd/MM/yyyy').format(lastProdDate)}',
                      style: AppTypography.small,
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showDetails(BuildContext context, List<Lot> lots) {
    showModalBottomSheet(
      context: context,
      builder: (context) => Container(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(product.name, style: AppTypography.h2),
            const SizedBox(height: 4),
            Text('Stock total: ${product.currentStock} ${product.unit}s', style: AppTypography.body),
            const SizedBox(height: 16),
            Text('LOTS EN STOCK (FIFO)', style: AppTypography.label),
            const SizedBox(height: 8),
            if (lots.isEmpty)
              Padding(
                padding: const EdgeInsets.all(16),
                child: Center(
                  child: Text('Aucun lot', style: AppTypography.caption),
                ),
              )
            else
              ...lots.map((lot) => ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(lot.lotNumber, style: AppTypography.bodyMedium),
                subtitle: Text(
                  'Prod: ${DateFormat('dd/MM/yyyy').format(lot.productionDate)}' +
                  (lot.expiryDate != null ? ' • DLC: ${DateFormat('dd/MM/yyyy').format(lot.expiryDate!)}' : ''),
                  style: AppTypography.caption,
                ),
                trailing: Text(
                  '${lot.quantity} ${product.unit}s',
                  style: AppTypography.bodyMedium,
                ),
              )),
          ],
        ),
      ),
    );
  }
}
