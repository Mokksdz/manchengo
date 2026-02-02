import 'package:flutter/material.dart';

class StockScreen extends StatelessWidget {
  const StockScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Stock'),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Matières Premières'),
              Tab(text: 'Produits Finis'),
            ],
          ),
        ),
        body: const TabBarView(
          children: [
            _StockMpTab(),
            _StockPfTab(),
          ],
        ),
      ),
    );
  }
}

class _StockMpTab extends StatelessWidget {
  const _StockMpTab();

  @override
  Widget build(BuildContext context) {
    // TODO: Load from repository
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: 0,
      itemBuilder: (context, index) {
        return const Card(
          child: ListTile(
            title: Text('Lot MP'),
          ),
        );
      },
    );
  }
}

class _StockPfTab extends StatelessWidget {
  const _StockPfTab();

  @override
  Widget build(BuildContext context) {
    // TODO: Load from repository
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: 0,
      itemBuilder: (context, index) {
        return const Card(
          child: ListTile(
            title: Text('Lot PF'),
          ),
        );
      },
    );
  }
}
