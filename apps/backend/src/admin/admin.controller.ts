import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiBody } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CreateProductMpDto,
  UpdateProductMpDto,
  CreateProductPfDto,
  UpdateProductPfDto,
  CreateClientDto,
  UpdateClientDto,
  CreateSupplierDto,
  UpdateSupplierDto,
  CreateUserDto,
  UpdateUserDto,
  ResetPasswordDto,
  CreateInvoiceDto,
  UpdateInvoiceDto,
  UpdateInvoiceStatusDto,
  StockAdjustmentDto,
  RevokeDeviceDto,
} from './dto/admin.dto';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(private adminService: AdminService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // STOCK
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('stock/mp')
  @Roles('ADMIN', 'APPRO')
  @ApiOperation({ summary: 'Get MP stock overview' })
  async getStockMp() {
    return this.adminService.getStockMp();
  }

  @Get('stock/pf')
  @Roles('ADMIN', 'COMMERCIAL', 'PRODUCTION')
  @ApiOperation({ summary: 'Get PF stock overview' })
  async getStockPf() {
    return this.adminService.getStockPf();
  }

  @Get('stock/movements')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get stock movements (audit)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'type', required: false, enum: ['MP', 'PF'] })
  async getStockMovements(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
  ) {
    return this.adminService.getStockMovements({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      type,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INVOICES
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('invoices')
  @Roles('ADMIN', 'COMMERCIAL')
  @ApiOperation({ summary: 'Get invoices list' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  async getInvoices(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getInvoices({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      status,
      search,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCTION
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('production')
  @Roles('ADMIN', 'PRODUCTION')
  @ApiOperation({ summary: 'Get production orders' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  async getProductionOrders(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getProductionOrders({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      status,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CLIENTS & SUPPLIERS
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('clients')
  @Roles('ADMIN', 'COMMERCIAL')
  @ApiOperation({ summary: 'Get clients list' })
  async getClients() {
    return this.adminService.getClients();
  }

  @Get('clients/:id')
  @Roles('ADMIN', 'COMMERCIAL')
  @ApiOperation({ summary: 'Get client by ID' })
  async getClient(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getClientById(id);
  }

  @Get('clients/:id/history')
  @Roles('ADMIN', 'COMMERCIAL')
  @ApiOperation({ summary: 'Get client invoice history with filters' })
  async getClientHistory(
    @Param('id', ParseIntPipe) id: number,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getClientHistory(id, {
      year: year ? parseInt(year) : undefined,
      month: month ? parseInt(month) : undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  @Get('suppliers')
  @Roles('ADMIN', 'APPRO')
  @ApiOperation({ summary: 'Get suppliers list' })
  async getSuppliers() {
    return this.adminService.getSuppliers();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USERS & DEVICES
  // ═══════════════════════════════════════════════════════════════════════════

  // A29: Added pagination support
  @Get('users')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get users list' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'role', required: false })
  async getUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('role') role?: string,
  ) {
    return this.adminService.getUsers({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      role,
    });
  }

  @Get('devices')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get devices list' })
  async getDevices() {
    return this.adminService.getDevices();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCTS MP - CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('products/mp')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create new MP product' })
  @ApiBody({ type: CreateProductMpDto })
  async createProductMp(@Body() dto: CreateProductMpDto) {
    return this.adminService.createProductMp(dto);
  }

  @Put('products/mp/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update MP product' })
  @ApiBody({ type: UpdateProductMpDto })
  async updateProductMp(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductMpDto,
  ) {
    return this.adminService.updateProductMp(id, dto);
  }

  @Delete('products/mp/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete MP product' })
  async deleteProductMp(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteProductMp(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCTS PF - CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('products/pf')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create new PF product' })
  @ApiBody({ type: CreateProductPfDto })
  async createProductPf(@Body() dto: CreateProductPfDto) {
    return this.adminService.createProductPf(dto);
  }

  @Put('products/pf/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update PF product' })
  @ApiBody({ type: UpdateProductPfDto })
  async updateProductPf(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductPfDto,
  ) {
    return this.adminService.updateProductPf(id, dto);
  }

  @Delete('products/pf/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete PF product' })
  async deleteProductPf(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteProductPf(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CLIENTS - CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('clients')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create new client' })
  @ApiBody({ type: CreateClientDto })
  async createClient(@Body() dto: CreateClientDto) {
    return this.adminService.createClient(dto);
  }

  @Put('clients/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update client' })
  @ApiBody({ type: UpdateClientDto })
  async updateClient(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClientDto,
  ) {
    return this.adminService.updateClient(id, dto);
  }

  @Delete('clients/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete client' })
  async deleteClient(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteClient(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPPLIERS - CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('suppliers')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create new supplier' })
  @ApiBody({ type: CreateSupplierDto })
  async createSupplier(@Body() dto: CreateSupplierDto) {
    return this.adminService.createSupplier(dto);
  }

  @Put('suppliers/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update supplier' })
  @ApiBody({ type: UpdateSupplierDto })
  async updateSupplier(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.adminService.updateSupplier(id, dto);
  }

  @Delete('suppliers/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete supplier' })
  async deleteSupplier(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteSupplier(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USERS - CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('users')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create new user' })
  @ApiBody({ type: CreateUserDto })
  async createUser(@Body() dto: CreateUserDto) {
    return this.adminService.createUser(dto);
  }

  @Put('users/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update user' })
  @ApiBody({ type: UpdateUserDto })
  async updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.adminService.updateUser(id, dto);
  }

  @Post('users/:id/reset-password')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Reset user password' })
  @ApiBody({ type: ResetPasswordDto })
  async resetUserPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @Request() req: any,
  ) {
    return this.adminService.resetUserPassword(id, dto.newPassword, req.user);
  }

  @Post('users/:id/toggle-status')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Toggle user active status' })
  async toggleUserStatus(@Param('id') id: string, @Request() req: any) {
    return this.adminService.toggleUserStatus(id, req.user);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INVOICES - CREATE & STATUS
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('invoices')
  @Roles('ADMIN', 'COMMERCIAL')
  @ApiOperation({ summary: 'Créer une nouvelle facture' })
  @ApiBody({ type: CreateInvoiceDto })
  async createInvoice(@Body() dto: CreateInvoiceDto, @Request() req: any) {
    return this.adminService.createInvoice(dto, req.user.id);
  }

  @Get('invoices/:id')
  @Roles('ADMIN', 'COMMERCIAL')
  @ApiOperation({ summary: 'Récupérer une facture par ID avec détails complets' })
  async getInvoiceById(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getInvoiceById(id);
  }

  @Put('invoices/:id')
  @Roles('ADMIN', 'COMMERCIAL')
  @ApiOperation({ summary: 'Modifier une facture (DRAFT uniquement)' })
  @ApiBody({ type: UpdateInvoiceDto })
  async updateInvoice(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInvoiceDto,
    @Request() req: any,
  ) {
    return this.adminService.updateInvoice(id, dto, req.user.id);
  }

  @Put('invoices/:id/status')
  @Roles('ADMIN', 'COMMERCIAL')
  @ApiOperation({ summary: 'Changer le statut (DRAFT→PAID, DRAFT→CANCELLED)' })
  @ApiBody({ type: UpdateInvoiceStatusDto })
  async updateInvoiceStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInvoiceStatusDto,
    @Request() req: any,
  ) {
    return this.adminService.updateInvoiceStatus(id, dto.status, req.user.id, req.user.role);
  }

  @Get('invoices/:id/pdf')
  @Roles('ADMIN', 'COMMERCIAL')
  @ApiOperation({ summary: 'Générer les données PDF fiscal de la facture' })
  async getInvoicePdf(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getInvoicePdfData(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STOCK ADJUSTMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('stock/adjust')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Manual stock adjustment' })
  @ApiBody({ type: StockAdjustmentDto })
  async adjustStock(@Body() dto: StockAdjustmentDto, @Request() req: any) {
    return this.adminService.adjustStock(dto, req.user.id, req.user);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEVICES - MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════════════
  // SECURITY LOGS (A6)
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('security-logs')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get security audit logs (server-side pagination)' })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'page', required: false })
  async getSecurityLogs(
    @Query('action') action?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    return this.adminService.getSecurityLogs({
      action,
      limit: limit ? parseInt(limit) : 25,
      page: page ? parseInt(page) : 1,
    });
  }

  @Post('devices/:id/revoke')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Revoke device access' })
  @ApiBody({ type: RevokeDeviceDto })
  async revokeDevice(
    @Param('id') id: string,
    @Body() dto: RevokeDeviceDto,
    @Request() req: any,
  ) {
    return this.adminService.revokeDevice(id, req.user.id, dto.reason);
  }

  @Post('devices/:id/reactivate')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Reactivate device' })
  async reactivateDevice(@Param('id') id: string) {
    return this.adminService.reactivateDevice(id);
  }
}
