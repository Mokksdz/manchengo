import 'package:flutter/material.dart';

class ProductionScreen extends StatelessWidget {
  const ProductionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Production'),
      ),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: 0, // TODO: Load from repository
        itemBuilder: (context, index) {
          return const Card(
            child: ListTile(
              title: Text('Ordre de fabrication'),
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          // TODO: QR scan for production
        },
        child: const Icon(Icons.qr_code_scanner),
      ),
    );
  }
}
