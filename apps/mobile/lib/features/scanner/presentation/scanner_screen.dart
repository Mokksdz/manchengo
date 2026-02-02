import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

class ScannerScreen extends StatefulWidget {
  final String mode;

  const ScannerScreen({
    super.key,
    this.mode = 'general',
  });

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  final MobileScannerController _controller = MobileScannerController();
  bool _isProcessing = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_isProcessing) return;

    final barcode = capture.barcodes.firstOrNull;
    if (barcode?.rawValue == null) return;

    setState(() => _isProcessing = true);

    final value = barcode!.rawValue!;
    _processQrCode(value);
  }

  void _processQrCode(String data) {
    // Parse Manchengo QR format: MCG:TYPE:ID:REFERENCE
    if (!data.startsWith('MCG:')) {
      _showError('QR Code non reconnu');
      setState(() => _isProcessing = false);
      return;
    }

    final parts = data.split(':');
    if (parts.length < 4) {
      _showError('Format QR invalide');
      setState(() => _isProcessing = false);
      return;
    }

    final type = parts[1];
    final id = parts[2];
    final reference = parts[3];

    // Navigate based on type and mode
    Navigator.of(context).pop({
      'type': type,
      'id': id,
      'reference': reference,
      'raw': data,
    });
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_getModeTitle()),
        actions: [
          IconButton(
            icon: const Icon(Icons.flash_on),
            onPressed: () => _controller.toggleTorch(),
          ),
          IconButton(
            icon: const Icon(Icons.flip_camera_ios),
            onPressed: () => _controller.switchCamera(),
          ),
        ],
      ),
      body: Stack(
        children: [
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
          ),
          // Scan overlay
          Center(
            child: Container(
              width: 250,
              height: 250,
              decoration: BoxDecoration(
                border: Border.all(
                  color: Theme.of(context).colorScheme.primary,
                  width: 3,
                ),
                borderRadius: BorderRadius.circular(16),
              ),
            ),
          ),
          // Instructions
          Positioned(
            bottom: 100,
            left: 0,
            right: 0,
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(24),
                ),
                child: Text(
                  _getModeInstructions(),
                  style: const TextStyle(color: Colors.white),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _getModeTitle() {
    switch (widget.mode) {
      case 'reception':
        return 'Scanner Lot MP';
      case 'production':
        return 'Scanner Production';
      case 'delivery':
        return 'Scanner Livraison';
      default:
        return 'Scanner QR';
    }
  }

  String _getModeInstructions() {
    switch (widget.mode) {
      case 'reception':
        return 'Scannez le QR du lot matière première';
      case 'production':
        return 'Scannez le QR de l\'ordre de fabrication';
      case 'delivery':
        return 'Scannez le QR du lot produit fini';
      default:
        return 'Positionnez le QR code dans le cadre';
    }
  }
}
