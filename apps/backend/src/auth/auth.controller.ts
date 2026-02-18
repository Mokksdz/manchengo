import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import {
  LoginDto,
  CreateUserDto,
  ChangePasswordDto,
  UserRole,
} from './dto/auth.dto';
import {
  ACCESS_TOKEN_COOKIE_OPTIONS,
  REFRESH_TOKEN_COOKIE_OPTIONS,
  CLEAR_COOKIE_OPTIONS,
  CLEAR_REFRESH_COOKIE_OPTIONS,
  COOKIE_NAMES,
} from './config/cookie.config';
import { CsrfMiddleware } from '../common/middleware/csrf.middleware';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGIN - Rate limited: 5 attempts per minute
  // ═══════════════════════════════════════════════════════════════════════════
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  @ApiOperation({ summary: 'Login (web or mobile)' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many login attempts' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const result = await this.authService.login(dto, ipAddress, userAgent);

    // Set httpOnly cookies for tokens
    res.cookie(
      COOKIE_NAMES.ACCESS_TOKEN,
      result.accessToken,
      ACCESS_TOKEN_COOKIE_OPTIONS,
    );
    res.cookie(
      COOKIE_NAMES.REFRESH_TOKEN,
      result.refreshToken,
      REFRESH_TOKEN_COOKIE_OPTIONS,
    );

    // Generate CSRF token for web clients
    CsrfMiddleware.generateToken(res);

    // Return user info + access token in body
    // (httpOnly cookies for web, body token for desktop/mobile clients)
    return {
      message: 'Login successful',
      access_token: result.accessToken,
      user: result.user,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REFRESH - Rate limited: 20 attempts per minute
  // Reads refresh token from httpOnly cookie
  // ═══════════════════════════════════════════════════════════════════════════
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 attempts per minute
  @ApiOperation({ summary: 'Refresh access token (uses httpOnly cookie)' })
  @ApiResponse({ status: 200, description: 'Token refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  @ApiResponse({ status: 429, description: 'Too many refresh attempts' })
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Get refresh token from httpOnly cookie
    const refreshToken = req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN];

    if (!refreshToken) {
      // Clear any stale cookies
      res.cookie(COOKIE_NAMES.ACCESS_TOKEN, '', CLEAR_COOKIE_OPTIONS);
      res.cookie(COOKIE_NAMES.REFRESH_TOKEN, '', CLEAR_REFRESH_COOKIE_OPTIONS);
      throw new UnauthorizedException('No refresh token provided');
    }

    const result = await this.authService.refreshToken({ refreshToken });

    // Set new httpOnly cookies
    res.cookie(
      COOKIE_NAMES.ACCESS_TOKEN,
      result.accessToken,
      ACCESS_TOKEN_COOKIE_OPTIONS,
    );
    res.cookie(
      COOKIE_NAMES.REFRESH_TOKEN,
      result.refreshToken,
      REFRESH_TOKEN_COOKIE_OPTIONS,
    );

    // Renew CSRF token with new session
    CsrfMiddleware.generateToken(res);

    return {
      message: 'Token refreshed successfully',
      access_token: result.accessToken,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGOUT - Clear all auth cookies
  // ═══════════════════════════════════════════════════════════════════════════
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle() // No rate limit on logout
  @ApiOperation({ summary: 'Logout (invalidate refresh token and clear cookies)' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Get refresh token from cookie to invalidate in DB
    const refreshToken = req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN];

    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    // Clear all auth cookies
    res.cookie(COOKIE_NAMES.ACCESS_TOKEN, '', CLEAR_COOKIE_OPTIONS);
    res.cookie(COOKIE_NAMES.REFRESH_TOKEN, '', CLEAR_REFRESH_COOKIE_OPTIONS);

    return { message: 'Logged out successfully' };
  }

  @Post('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create new user (admin only)' })
  @ApiResponse({ status: 201, description: 'User created' })
  @ApiResponse({ status: 409, description: 'Email or code already exists' })
  async createUser(@Body() dto: CreateUserDto) {
    return this.authService.createUser(dto);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CSRF TOKEN - Generate/refresh CSRF token for web clients
  // ═══════════════════════════════════════════════════════════════════════════
  @Get('csrf-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a fresh CSRF token (set as cookie + returned in body)' })
  @ApiResponse({ status: 200, description: 'CSRF token generated' })
  async getCsrfToken(@Res({ passthrough: true }) res: Response) {
    const token = CsrfMiddleware.generateToken(res);
    return { csrfToken: token };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user info' })
  async getMe(@Req() req: Request & { user: { passwordHash: string; [key: string]: unknown } }) {
    const { passwordHash, ...user } = req.user;
    return user;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // R3: CHANGE PASSWORD - Force password change for seed users
  // ═══════════════════════════════════════════════════════════════════════════
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Change password (forced for seed users on first login)' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid current password or weak new password' })
  async changePassword(
    @Body() body: ChangePasswordDto,
    @Req() req: Request & { user: { id: string } },
  ) {
    const userId = req.user.id;
    if (!userId) throw new UnauthorizedException('Utilisateur non identifié');

    return this.authService.changePassword(
      userId,
      body.currentPassword,
      body.newPassword,
    );
  }
}
