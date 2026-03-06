import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DashboardGateway } from './dashboard.gateway';

/**
 * R18: WebSocket Module
 * Global so any service can inject DashboardGateway to emit events
 */
@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [DashboardGateway],
  exports: [DashboardGateway],
})
export class WebSocketModule {}
