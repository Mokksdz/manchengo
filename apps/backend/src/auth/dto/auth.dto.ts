import { IsString, IsEmail, IsEnum, IsOptional, MinLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export { UserRole };

export class LoginDto {
  @ApiProperty({ example: 'admin@manchengo.dz' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ description: 'Device UUID for mobile login' })
  @IsString()
  @IsOptional()
  deviceId?: string;

  @ApiPropertyOptional({ description: 'Device name' })
  @IsString()
  @IsOptional()
  deviceName?: string;

  @ApiPropertyOptional({ description: 'Platform (android, ios, web)' })
  @IsString()
  @IsOptional()
  platform?: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}

export class CreateUserDto {
  @ApiProperty({ example: 'USR-002' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'user@manchengo.dz' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'P@ssword1234!' })
  @IsString()
  @MinLength(12, { message: 'Le mot de passe doit contenir au moins 12 caractères' })
  @Matches(/[A-Z]/, { message: 'Le mot de passe doit contenir au moins une majuscule' })
  @Matches(/[a-z]/, { message: 'Le mot de passe doit contenir au moins une minuscule' })
  @Matches(/[0-9]/, { message: 'Le mot de passe doit contenir au moins un chiffre' })
  @Matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, { message: 'Le mot de passe doit contenir au moins un caractère spécial' })
  password: string;

  @ApiProperty({ example: 'Jean' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Dupont' })
  @IsString()
  lastName: string;

  @ApiProperty({ enum: UserRole, example: UserRole.COMMERCIAL })
  @IsEnum(UserRole)
  role: UserRole;
}

export class RegisterDeviceDto {
  @ApiProperty({ description: 'Device UUID' })
  @IsString()
  deviceId: string;

  @ApiProperty({ description: 'Device name' })
  @IsString()
  deviceName: string;

  @ApiProperty({ description: 'Platform', example: 'android' })
  @IsString()
  platform: string;

  @ApiPropertyOptional({ description: 'App version' })
  @IsString()
  @IsOptional()
  appVersion?: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: 'Le mot de passe actuel est obligatoire' })
  currentPassword: string;

  @IsString()
  @MinLength(12, { message: 'Le nouveau mot de passe doit contenir au moins 12 caractères' })
  @Matches(/[A-Z]/, { message: 'Le mot de passe doit contenir au moins une majuscule' })
  @Matches(/[a-z]/, { message: 'Le mot de passe doit contenir au moins une minuscule' })
  @Matches(/[0-9]/, { message: 'Le mot de passe doit contenir au moins un chiffre' })
  @Matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, { message: 'Le mot de passe doit contenir au moins un caractère spécial' })
  newPassword: string;
}

// Response types
export class AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    code: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    mustChangePassword?: boolean; // R3: Force password change for seed users
  };
}

export class TokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  deviceId?: string;
}
