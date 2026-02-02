import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../core/qr/qr.dart';
import '../../core/theme/app_colors.dart';

/// Fullscreen QR scanner screen
/// 
/// Returns [QrCodePayload] on successful scan via Navigator.pop()
/// Returns null if user cancels
class QrScannerScreen extends StatefulWidget {
  final String? title;
  final String? hint;
  
  const QrScannerScreen({
    super.key,
    this.title,
    this.hint,
  });

  @override
  State<QrScannerScreen> createState() => _QrScannerScreenState();
}

class _QrScannerScreenState extends State<QrScannerScreen> {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.normal,
    facing: CameraFacing.back,
    torchEnabled: false,
  );
  
  bool _hasScanned = false;
  String? _errorMessage;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    // Scan only once
    if (_hasScanned) return;
    
    final barcodes = capture.barcodes;
    if (barcodes.isEmpty) return;
    
    final rawValue = barcodes.first.rawValue;
    if (rawValue == null || rawValue.isEmpty) return;
    
    // Parse QR code
    try {
      final payload = QrParser.parse(rawValue);
      _hasScanned = true;
      
      // Return payload to caller
      Navigator.of(context).pop(payload);
    } on InvalidQrCodeError catch (e) {
      // Show error but allow retry
      setState(() {
        _errorMessage = e.message;
      });
      
      // Clear error after 3 seconds
      Future.delayed(const Duration(seconds: 3), () {
        if (mounted) {
          setState(() => _errorMessage = null);
        }
      });
    }
  }

  void _toggleTorch() {
    _controller.toggleTorch();
  }

  void _switchCamera() {
    _controller.switchCamera();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // Camera preview
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
          ),
          
          // Overlay
          _buildOverlay(),
          
          // Top bar
          _buildTopBar(),
          
          // Bottom controls
          _buildBottomControls(),
          
          // Error message
          if (_errorMessage != null) _buildErrorBanner(),
        ],
      ),
    );
  }

  Widget _buildTopBar() {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            // Close button
            IconButton(
              onPressed: () => Navigator.of(context).pop(null),
              icon: const Icon(Icons.close, color: Colors.white, size: 28),
            ),
            const SizedBox(width: 8),
            
            // Title
            Expanded(
              child: Text(
                widget.title ?? 'Scanner QR',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOverlay() {
    return ColorFiltered(
      colorFilter: ColorFilter.mode(
        Colors.black.withOpacity(0.5),
        BlendMode.srcOut,
      ),
      child: Stack(
        children: [
          // Full overlay
          Container(
            decoration: const BoxDecoration(
              color: Colors.black,
              backgroundBlendMode: BlendMode.dstOut,
            ),
          ),
          
          // Transparent scan area
          Center(
            child: Container(
              width: 280,
              height: 280,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomControls() {
    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Hint text
              Text(
                widget.hint ?? 'Placez le code QR dans le cadre',
                style: const TextStyle(
                  color: Colors.white70,
                  fontSize: 14,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              
              // Control buttons
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Torch button
                  ValueListenableBuilder(
                    valueListenable: _controller.torchState,
                    builder: (context, state, child) {
                      return _ControlButton(
                        icon: state == TorchState.on
                            ? Icons.flash_on
                            : Icons.flash_off,
                        label: 'Flash',
                        isActive: state == TorchState.on,
                        onTap: _toggleTorch,
                      );
                    },
                  ),
                  const SizedBox(width: 32),
                  
                  // Switch camera button
                  _ControlButton(
                    icon: Icons.cameraswitch,
                    label: 'Caméra',
                    onTap: _switchCamera,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildErrorBanner() {
    return Positioned(
      top: 100,
      left: 24,
      right: 24,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.error,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            const Icon(Icons.error_outline, color: Colors.white, size: 20),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                _errorMessage!,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Control button for scanner
class _ControlButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool isActive;

  const _ControlButton({
    required this.icon,
    required this.label,
    required this.onTap,
    this.isActive = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: isActive ? AppColors.brandGold : Colors.white24,
              shape: BoxShape.circle,
            ),
            child: Icon(
              icon,
              color: Colors.white,
              size: 24,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}
