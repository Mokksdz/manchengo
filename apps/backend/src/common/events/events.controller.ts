/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * EVENTS CONTROLLER — API pour l'Event Sourcing
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Endpoints REST pour:
 * - Consulter les événements
 * - Statistiques de l'event store
 * - Timeline d'un aggregate
 * - Reconstruction d'historique
 *
 * @version 1.0.0
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { EventStoreService, EventType, EventCategory, EventSearchCriteria } from './event-store.service';
import { EventReplayService } from './event-replay.service';

@ApiTags('Events')
@ApiBearerAuth()
@Controller('events')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EventsController {
  constructor(
    private readonly eventStore: EventStoreService,
    private readonly eventReplay: EventReplayService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════════
  // EVENT STORE STATISTICS
  // ═══════════════════════════════════════════════════════════════════════════════

  @Get('stats')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get event store statistics' })
  @ApiResponse({
    status: 200,
    description: 'Event store statistics',
    schema: {
      type: 'object',
      properties: {
        totalEvents: { type: 'number' },
        currentVersion: { type: 'number' },
        byCategory: { type: 'object' },
        byType: { type: 'object' },
        eventsLast24h: { type: 'number' },
        eventsLast7d: { type: 'number' },
      },
    },
  })
  async getStats() {
    return this.eventStore.getStats();
  }

  @Get('version')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get current event store version' })
  async getCurrentVersion() {
    return {
      version: this.eventStore.getCurrentVersion(),
      timestamp: new Date().toISOString(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // EVENT SEARCH
  // ═══════════════════════════════════════════════════════════════════════════════

  @Get()
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Search events with filters' })
  @ApiQuery({ name: 'aggregateType', required: false })
  @ApiQuery({ name: 'aggregateId', required: false })
  @ApiQuery({ name: 'eventTypes', required: false, description: 'Comma-separated event types' })
  @ApiQuery({ name: 'categories', required: false, description: 'Comma-separated categories' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'correlationId', required: false })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async searchEvents(
    @Query('aggregateType') aggregateType?: string,
    @Query('aggregateId') aggregateId?: string,
    @Query('eventTypes') eventTypes?: string,
    @Query('categories') categories?: string,
    @Query('userId') userId?: string,
    @Query('correlationId') correlationId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const criteria: EventSearchCriteria = {
      aggregateType,
      aggregateId,
      userId,
      correlationId,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    };

    if (eventTypes) {
      criteria.eventTypes = eventTypes.split(',') as EventType[];
    }

    if (categories) {
      criteria.categories = categories.split(',') as EventCategory[];
    }

    if (fromDate) {
      criteria.fromDate = new Date(fromDate);
    }

    if (toDate) {
      criteria.toDate = new Date(toDate);
    }

    return this.eventStore.search(criteria);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get event by ID' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  async getEventById(@Param('id') id: string) {
    const event = await this.eventStore.getById(id);
    if (!event) {
      throw new NotFoundException(`Event ${id} not found`);
    }
    return event;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // AGGREGATE EVENTS
  // ═══════════════════════════════════════════════════════════════════════════════

  @Get('aggregate/:type/:id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get all events for an aggregate' })
  @ApiParam({ name: 'type', description: 'Aggregate type (e.g., ProductMp, ProductionOrder)' })
  @ApiParam({ name: 'id', description: 'Aggregate ID' })
  @ApiQuery({ name: 'fromVersion', required: false, type: Number })
  async getAggregateEvents(
    @Param('type') type: string,
    @Param('id') id: string,
    @Query('fromVersion') fromVersion?: number,
  ) {
    const events = await this.eventStore.getByAggregate(
      type,
      id,
      fromVersion ? Number(fromVersion) : undefined,
    );

    return {
      aggregateType: type,
      aggregateId: id,
      events,
      count: events.length,
    };
  }

  @Get('aggregate/:type/:id/timeline')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get timeline for an aggregate' })
  @ApiParam({ name: 'type', description: 'Aggregate type' })
  @ApiParam({ name: 'id', description: 'Aggregate ID' })
  async getAggregateTimeline(
    @Param('type') type: string,
    @Param('id') id: string,
  ) {
    return this.eventReplay.generateTimeline(type, id);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STOCK HISTORY (Use case ERP)
  // ═══════════════════════════════════════════════════════════════════════════════

  @Get('stock/mp/:id/history')
  @Roles('ADMIN', 'MANAGER', 'APPRO')
  @ApiOperation({ summary: 'Get stock history for a MP' })
  @ApiParam({ name: 'id', description: 'MP ID' })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  async getMpStockHistory(
    @Param('id') id: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.eventReplay.reconstructMpStockHistory(
      Number(id),
      {
        fromDate: fromDate ? new Date(fromDate) : undefined,
        toDate: toDate ? new Date(toDate) : undefined,
      },
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRODUCTION HISTORY
  // ═══════════════════════════════════════════════════════════════════════════════

  @Get('production/history')
  @Roles('ADMIN', 'MANAGER', 'PRODUCTION')
  @ApiOperation({ summary: 'Get production history' })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  @ApiQuery({ name: 'recipeId', required: false, type: Number })
  async getProductionHistory(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('recipeId') recipeId?: number,
  ) {
    return this.eventReplay.reconstructProductionHistory({
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      recipeId: recipeId ? Number(recipeId) : undefined,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CORRELATION TRACKING
  // ═══════════════════════════════════════════════════════════════════════════════

  @Get('correlation/:id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get all events for a correlation ID' })
  @ApiParam({ name: 'id', description: 'Correlation ID' })
  async getCorrelatedEvents(@Param('id') id: string) {
    const result = await this.eventStore.search({
      correlationId: id,
      limit: 1000,
    });

    return {
      correlationId: id,
      events: result.events,
      count: result.total,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // EVENT TYPES REFERENCE
  // ═══════════════════════════════════════════════════════════════════════════════

  @Get('reference/types')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get all available event types' })
  async getEventTypes() {
    return {
      eventTypes: Object.values(EventType),
      categories: Object.values(EventCategory),
    };
  }
}
