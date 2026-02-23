import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * DASHBOARD WEBSOCKET GATEWAY — Manchengo Smart ERP
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * R18: WebSocket pour dashboard temps réel
 *
 * Room-based routing for 500+ concurrent users:
 * - Clients join rooms by module interest (stock, production, delivery, sync)
 * - Events only broadcast to relevant rooms (not all clients)
 * - Emit throttle prevents broadcast storm under high mutation load
 *
 * Rooms:
 *   'stock'      - Stock alerts, inventory changes
 *   'production' - Production order status changes
 *   'delivery'   - Delivery validations
 *   'sync'       - Sync events
 *   'dashboard'  - General dashboard refresh (all users)
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
 *   this.gateway.emitStockAlert({ ... });
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const VALID_ROOMS = ['stock', 'production', 'delivery', 'sync', 'dashboard'] as const;
type RoomName = (typeof VALID_ROOMS)[number];

// Throttle window per event type (ms)
const THROTTLE_MS = 500;

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
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  private readonly logger = new Logger(DashboardGateway.name);

  @WebSocketServer()
  server: Server;

  private connectedClients = 0;

  // Throttle map: event key → last emit timestamp
  private lastEmitMap = new Map<string, number>();

  // Periodic cleanup interval handle
  private cleanupInterval: NodeJS.Timeout | null = null;

  afterInit() {
    this.logger.log('Dashboard WebSocket Gateway initialized (room-based)');

    // Periodic cleanup of throttle map
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, timestamp] of this.lastEmitMap) {
        if (now - timestamp > 60_000) {
          this.lastEmitMap.delete(key);
        }
      }
    }, 60_000);
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  handleConnection(client: Socket) {
    // Verify auth token from handshake
    const token = client.handshake.auth?.token || client.handshake.headers?.authorization;
    if (!token) {
      this.logger.warn(`Client ${client.id} rejected: no auth token`);
      client.disconnect(true);
      return;
    }

    // Auto-join the 'dashboard' room (general updates)
    client.join('dashboard');

    this.connectedClients++;
    this.logger.debug(
      `Client connected: ${client.id} (total: ${this.connectedClients})`,
    );
  }

  handleDisconnect(client: Socket) {
    this.connectedClients = Math.max(0, this.connectedClients - 1);
    this.logger.debug(
      `Client disconnected: ${client.id} (total: ${this.connectedClients})`,
    );
  }

  /**
   * Client subscribes to specific rooms for targeted updates
   * Message: { rooms: ['stock', 'production'] }
   */
  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, payload: { rooms?: string[] }) {
    const rooms = (payload?.rooms || []).filter((r): r is RoomName =>
      VALID_ROOMS.includes(r as RoomName),
    );

    for (const room of rooms) {
      client.join(room);
    }

    this.logger.debug(`Client ${client.id} subscribed to: ${rooms.join(', ')}`);
    return { subscribed: rooms };
  }

  /**
   * Client unsubscribes from rooms
   */
  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(client: Socket, payload: { rooms?: string[] }) {
    const rooms = (payload?.rooms || []).filter((r): r is RoomName =>
      VALID_ROOMS.includes(r as RoomName),
    );

    for (const room of rooms) {
      if (room !== 'dashboard') {
        client.leave(room);
      }
    }

    this.logger.debug(`Client ${client.id} unsubscribed from: ${rooms.join(', ')}`);
    return { unsubscribed: rooms };
  }

  /**
   * Emit to a specific room with throttle protection
   */
  private emitToRoom(room: RoomName, event: string, data: any) {
    if (!this.server) return;

    // Throttle: skip if same event emitted within THROTTLE_MS
    const throttleKey = `${room}:${event}`;
    const now = Date.now();
    const lastEmit = this.lastEmitMap.get(throttleKey) || 0;

    if (now - lastEmit < THROTTLE_MS) {
      this.logger.debug(`[THROTTLE] Skipped ${event} to room ${room} (${now - lastEmit}ms since last)`);
      return;
    }

    this.lastEmitMap.set(throttleKey, now);

    this.server.to(room).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });

    this.logger.debug(`Emitted ${event} to room '${room}'`);
  }

  /**
   * Emit a stock alert to stock room subscribers
   */
  emitStockAlert(alert: {
    type: string;
    severity: string;
    title: string;
    message: string;
  }) {
    this.emitToRoom('stock', 'stock:alert', alert);
    this.emitToRoom('dashboard', 'dashboard:update', { reason: 'stock_alert' });
  }

  /**
   * Emit production order update to production room
   */
  emitProductionUpdate(order: {
    orderId: string;
    status: string;
    productName: string;
  }) {
    this.emitToRoom('production', 'production:update', order);
    this.emitToRoom('dashboard', 'dashboard:update', { reason: 'production_update' });
  }

  /**
   * Emit delivery validation to delivery room
   */
  emitDeliveryValidated(delivery: {
    deliveryId: string;
    reference: string;
    clientName: string;
  }) {
    this.emitToRoom('delivery', 'delivery:validated', delivery);
    this.emitToRoom('dashboard', 'dashboard:update', { reason: 'delivery_validated' });
  }

  /**
   * Emit general dashboard refresh signal (broadcast to all)
   * (used after bulk operations, imports, etc.)
   */
  emitRefresh(reason: string) {
    this.emitToRoom('dashboard', 'dashboard:update', { reason });
  }

  /**
   * Backward-compatible emit method for services using the old API
   */
  emitDashboardUpdate(event: string, data: any) {
    // Route to appropriate room based on event prefix
    if (event.startsWith('stock:')) {
      this.emitToRoom('stock', event, data);
    } else if (event.startsWith('production:')) {
      this.emitToRoom('production', event, data);
    } else if (event.startsWith('delivery:')) {
      this.emitToRoom('delivery', event, data);
    } else if (event.startsWith('sync:')) {
      this.emitToRoom('sync', event, data);
    } else {
      this.emitToRoom('dashboard', event, data);
    }
  }

  /**
   * Get the number of connected clients
   */
  getConnectedClients(): number {
    return this.connectedClients;
  }
}
