import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import {
  LoginDto,
  RefreshTokenDto,
  CreateUserDto,
  AuthResponse,
  TokenPayload,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // Login user (web or mobile)
  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    // Register device if mobile login
    if (dto.deviceId) {
      await this.registerOrUpdateDevice(
        user.id,
        dto.deviceId,
        dto.deviceName || 'Unknown',
        dto.platform || 'unknown',
      );
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role, dto.deviceId);

    return {
      ...tokens,
      user: {
        id: user.id,
        code: user.code,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        mustChangePassword: user.mustChangePassword, // R3: Signal frontend to force password change
      },
    };
  }

  // R3: Change password (used for forced password change and voluntary change)
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Utilisateur invalide');
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new BadRequestException('Mot de passe actuel incorrect');
    }

    // Password strength validation
    this.validatePasswordStrength(newPassword);

    // Ensure new password is different
    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new BadRequestException('Le nouveau mot de passe doit être différent de l\'ancien');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    });

    return { success: true, message: 'Mot de passe modifié avec succès' };
  }

  // Private: Validate password strength (P2-18: min 12 chars + special char)
  private validatePasswordStrength(password: string): void {
    const MIN_PASSWORD_LENGTH = 12;
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(`Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères`);
    }
    if (!/[A-Z]/.test(password)) {
      throw new BadRequestException('Le mot de passe doit contenir au moins une majuscule');
    }
    if (!/[a-z]/.test(password)) {
      throw new BadRequestException('Le mot de passe doit contenir au moins une minuscule');
    }
    if (!/[0-9]/.test(password)) {
      throw new BadRequestException('Le mot de passe doit contenir au moins un chiffre');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      throw new BadRequestException('Le mot de passe doit contenir au moins un caractère spécial');
    }
  }

  // Refresh access token
  async refreshToken(dto: RefreshTokenDto): Promise<{ accessToken: string; refreshToken: string }> {
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: dto.refreshToken },
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Token de rafraîchissement invalide');
    }

    if (!storedToken.user.isActive) {
      throw new UnauthorizedException('Compte désactivé');
    }

    // Delete old token
    await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });

    // Generate new tokens
    return this.generateTokens(
      storedToken.user.id,
      storedToken.user.email,
      storedToken.user.role,
      storedToken.deviceId || undefined,
    );
  }

  // Logout (invalidate refresh token)
  async logout(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  }

  // Create new user (admin only)
  async createUser(dto: CreateUserDto): Promise<{ id: string; code: string; email: string }> {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { code: dto.code }],
      },
    });

    if (existingUser) {
      throw new ConflictException('Email ou code déjà utilisé');
    }

    // Password strength validation (shared helper)
    this.validatePasswordStrength(dto.password);

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        code: dto.code,
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
      },
    });

    return { id: user.id, code: user.code, email: user.email };
  }

  // Validate user from JWT payload
  async validateUser(payload: TokenPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Utilisateur invalide');
    }

    return user;
  }

  // Private: Generate access and refresh tokens
  private async generateTokens(
    userId: string,
    email: string,
    role: string,
    deviceId?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: TokenPayload = {
      sub: userId,
      email,
      role: role as any,
      deviceId,
    };

    const accessToken = this.jwtService.sign(payload);

    // Generate refresh token
    const refreshToken = uuidv4();
    const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';
    const expiresAt = new Date();
    // Parse duration string like '7d', '30d', '1d' — extract numeric part safely
    const daysMatch = refreshExpiresIn.match(/^(\d+)d$/);
    const refreshDays = daysMatch ? parseInt(daysMatch[1], 10) : 7;
    expiresAt.setDate(expiresAt.getDate() + refreshDays);

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        deviceId,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  // Private: Register or update device
  private async registerOrUpdateDevice(
    userId: string,
    deviceId: string,
    deviceName: string,
    platform: string,
  ): Promise<void> {
    await this.prisma.device.upsert({
      where: { id: deviceId },
      update: {
        name: deviceName,
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      },
      create: {
        id: deviceId,
        userId,
        name: deviceName,
        platform,
        isActive: true,
      },
    });
  }
}
