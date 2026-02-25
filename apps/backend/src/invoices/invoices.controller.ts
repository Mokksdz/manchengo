import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Req,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto, UpdateInvoiceDto, UpdateInvoiceStatusDto } from './dto/invoice.dto';

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICES CONTROLLER — REST API for Invoice Management
// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/invoices            — List all invoices (ADMIN, COMMERCIAL)
// GET /api/invoices/:id        — Get one invoice with details
// POST /api/invoices           — Create a new invoice (ADMIN, COMMERCIAL)
// PUT /api/invoices/:id        — Update invoice (DRAFT only) (ADMIN, COMMERCIAL)
// PUT /api/invoices/:id/status — Update invoice status (ADMIN)
// ═══════════════════════════════════════════════════════════════════════════════

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL)
  async findAll(
    @Query('status') status?: string,
    @Query('clientId') clientId?: string,
  ) {
    return this.invoicesService.findAll(
      status,
      clientId ? parseInt(clientId, 10) : undefined,
    );
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL)
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.invoicesService.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateInvoiceDto, @Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.invoicesService.create(dto, userId);
  }

  @Put(':id/edit')
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInvoiceDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.user?.sub;
    return this.invoicesService.update(id, dto, userId);
  }

  @Put(':id/status')
  @Roles(UserRole.ADMIN)
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInvoiceStatusDto,
  ) {
    return this.invoicesService.updateStatus(id, dto);
  }
}
