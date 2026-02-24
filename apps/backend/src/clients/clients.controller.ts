import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ClientsService } from './clients.service';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENTS CONTROLLER — REST API for Client Management
// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/clients         — List all clients (ADMIN, APPRO, COMMERCIAL)
// GET /api/clients/:id     — Get one client with invoices/deliveries
// POST /api/clients        — Create a new client (ADMIN)
// PUT /api/clients/:id     — Update a client (ADMIN)
// DELETE /api/clients/:id  — Delete a client (ADMIN, only if no relations)
// ═══════════════════════════════════════════════════════════════════════════════

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.APPRO, UserRole.COMMERCIAL)
  async findAll(@Query('type') type?: string) {
    return this.clientsService.findAll(type);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.APPRO, UserRole.COMMERCIAL)
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.clientsService.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clientsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.clientsService.remove(id);
  }
}
