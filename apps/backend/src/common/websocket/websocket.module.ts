import { Global, Module } from '@nestjs/common';
import { DashboardGateway } from './dashboard.gateway';

/**
 * R18: WebSocket Module
 * Global so any service can inject DashboardGateway to emit events
 */
@Global()
@Module({
  providers: [DashboardGateway],
  exports: [DashboardGateway],
})
export class WebSocketModule {}
