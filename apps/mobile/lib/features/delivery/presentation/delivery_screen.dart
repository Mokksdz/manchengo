import 'package:flutter/material.dart';

class DeliveryScreen extends StatelessWidget {
  const DeliveryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Livraisons'),
      ),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: 0, // TODO: Load from repository
        itemBuilder: (context, index) {
          return const Card(
            child: ListTile(
              title: Text('Bon de livraison'),
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          // TODO: QR scan for delivery
        },
        child: const Icon(Icons.qr_code_scanner),
      ),
    );
  }
}
