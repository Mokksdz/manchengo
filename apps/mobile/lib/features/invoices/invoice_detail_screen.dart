import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';
import '../../core/state/app_state.dart';
import '../../core/models/models.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/widgets/sync_indicator.dart';
import '../../core/widgets/status_badge.dart';

/// Invoice detail screen
class InvoiceDetailScreen extends StatelessWidget {
  final String invoiceId;

  const InvoiceDetailScreen({super.key, required this.invoiceId});

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    final invoice = appState.invoices.firstWhere(
      (i) => i.id == invoiceId,
      orElse: () => appState.invoices.first,
    );

    final dateFormat = DateFormat('dd/MM/yyyy');
    final currencyFormat = NumberFormat.currency(
      locale: 'fr_DZ',
      symbol: 'DA',
      decimalDigits: 2,
    );

    String formatPrice(int centimes) => currencyFormat.format(centimes / 100);

    return Scaffold(
      appBar: AppBar(
        title: Text('Facture ${invoice.reference}'),
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
                  // Invoice header
                  Card(
                    color: AppColors.brandBlue,
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        children: [
                          Text(
                            'MANCHENGO SARL',
                            style: AppTypography.h2.copyWith(color: AppColors.white),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Facture N° ${invoice.reference}',
                            style: AppTypography.body.copyWith(color: AppColors.neutral300),
                          ),
                          Text(
                            'Date: ${dateFormat.format(invoice.date)}',
                            style: AppTypography.caption.copyWith(color: AppColors.neutral300),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Client info
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Client', style: AppTypography.label),
                          const SizedBox(height: 8),
                          Text(invoice.clientName, style: AppTypography.bodyMedium),
                          if (invoice.clientNif != null) ...[
                            const SizedBox(height: 4),
                            Text(
                              'NIF: ${invoice.clientNif}',
                              style: AppTypography.caption,
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Line items
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Détails', style: AppTypography.label),
                          const SizedBox(height: 12),
                          ...invoice.lines.map((line) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(line.productName, style: AppTypography.bodyMedium),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      '${line.quantity} × ${formatPrice(line.unitPriceHt)}',
                                      style: AppTypography.caption,
                                    ),
                                    Text(
                                      formatPrice(line.lineHt),
                                      style: AppTypography.body,
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          )),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Totals
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        children: [
                          _buildRow('Sous-total HT:', formatPrice(invoice.totalHt)),
                          const SizedBox(height: 8),
                          _buildRow('TVA (19%):', formatPrice(invoice.totalTva)),
                          const Divider(height: 24),
                          _buildRow('Total TTC:', formatPrice(invoice.totalTtc)),
                          const SizedBox(height: 16),
                          _buildRow(
                            'Paiement:',
                            invoice.paymentMethod.label,
                          ),
                          if (invoice.timbreFiscal > 0) ...[
                            const SizedBox(height: 8),
                            _buildRow('Timbre fiscal:', formatPrice(invoice.timbreFiscal)),
                          ],
                          const Divider(height: 24),
                          _buildRow(
                            'NET À PAYER:',
                            formatPrice(invoice.netToPay),
                            isBold: true,
                            isLarge: true,
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Status
                  Center(
                    child: StatusBadge.invoice(invoice.status),
                  ),
                ],
              ),
            ),
          ),

          // Bottom actions
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
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _shareInvoice(context, invoice),
                      icon: const Icon(Icons.share),
                      label: const Text('Partager'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () => _printInvoice(context),
                      icon: const Icon(Icons.print),
                      label: const Text('Imprimer'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRow(String label, String value, {bool isBold = false, bool isLarge = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: isBold ? AppTypography.bodyMedium : AppTypography.body,
        ),
        Text(
          value,
          style: isLarge
              ? AppTypography.h2.copyWith(color: AppColors.brandGold)
              : (isBold ? AppTypography.bodyMedium : AppTypography.body),
        ),
      ],
    );
  }

  void _shareInvoice(BuildContext context, Invoice invoice) {
    // TODO: Generate PDF and share
    Share.share(
      'Facture ${invoice.reference}\nClient: ${invoice.clientName}\nTotal: ${invoice.netToPay / 100} DA',
      subject: 'Facture ${invoice.reference}',
    );
  }

  void _printInvoice(BuildContext context) {
    // TODO: Implement printing
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Impression non implémentée')),
    );
  }
}
