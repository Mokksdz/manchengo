import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * DASHBOARD WEBSOCKET GATEWAY — Manchengo Smart ERP
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * R18: WebSocket pour dashboard temps réel
 *
 * Provides real-time updates to dashboard clients via Socket.IO:
 * - Stock alerts (new critical alerts, lot expiry)
 * - Production order status changes
 * - Delivery validations
 * - Sync events
 *
 * Events emitted:
 *   'dashboard:update'    - General dashboard refresh signal
 *   'stock:alert'         - New stock alert
 *   'production:update'   - Production order status change
 *   'delivery:validated'  - Delivery validated via QR
 *   'sync:event'          - New sync event applied
 *
 * Usage (from any service):
 *   @Inject() private gateway: DashboardGateway;
 *   this.gateway.emitDashboardUpdate('stock:alert', { ... });
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGINS || 'http://localhost:3001,http://localhost:3000')
      .split(',')
      .map((o: string) => o.trim()),
    credentials: true,
  },
  namespace: '/dashboard',
  transports: ['websocket', 'polling'],
})
export class DashboardGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(DashboardGateway.name);

  @WebSocketServer()
  server: Server;

  private connectedClients = 0;

  afterInit() {
    this.logger.log('Dashboard WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    // Verify auth token from handshake
    const token = client.handshake.auth?.token || client.handshake.headers?.authorization;
    if (!token) {
      this.logger.warn(`Client ${client.id} rejected: no auth token`);
      client.disconnect(true);
      return;
    }

    this.connectedClients++;
    this.logger.debug(
      `Client connected: ${client.id} (total: ${this.connectedClients})`,
    );
  }

  handleDisconnect(client: Socket) {
    this.connectedClients--;
    this.logger.debug(
      `Client disconnected: ${client.id} (total: ${this.connectedClients})`,
    );
  }

  /**
   * Emit an event to all connected dashboard clients
   */
  emitDashboardUpdate(event: string, data: any) {
    if (this.server) {
      this.server.emit(event, {
        ...data,
        timestamp: new Date().toISOString(),
      });
      this.logger.debug(`Emitted ${event} to ${this.connectedClients} clients`);
    }
  }

  /**
   * Emit a stock alert to all clients
   */
  emitStockAlert(alert: {
    type: string;
    severity: string;
    title: string;
    message: string;
  }) {
    this.emitDashboardUpdate('stock:alert', alert);
  }

  /**
   * Emit production order update
   */
  emitProductionUpdate(order: {
    orderId: string;
    status: string;
    productName: string;
  }) {
    this.emitDashboardUpdate('production:update', order);
  }

  /**
   * Emit delivery validation
   */
  emitDeliveryValidated(delivery: {
    deliveryId: string;
    reference: string;
    clientName: string;
  }) {
    this.emitDashboardUpdate('delivery:validated', delivery);
  }

  /**
   * Emit general dashboard refresh signal
   * (used after bulk operations, imports, etc.)
   */
  emitRefresh(reason: string) {
    this.emitDashboardUpdate('dashboard:update', { reason });
  }

  /**
   * Get the number of connected clients
   */
  getConnectedClients(): number {
    return this.connectedClients;
  }
}
