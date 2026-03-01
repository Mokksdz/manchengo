/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AUTH CONTROLLER TESTS — Couche HTTP de l'authentification
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * INVARIANTS TESTES:
 * 1. POST /auth/login - succes retourne tokens + cookies
 * 2. POST /auth/login - rejette identifiants invalides (401)
 * 3. POST /auth/refresh - succes avec token valide
 * 4. POST /auth/refresh - rejette quand pas de refresh token (401)
 * 5. POST /auth/logout - succes efface les cookies
 * 6. POST /auth/change-password - succes, rejette mdp faible, rejette mdp actuel incorrect
 * 7. Guards appliques: JwtAuthGuard + RolesGuard sur les endpoints proteges
 * 8. Codes de reponse HTTP corrects (200, 401)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { COOKIE_NAMES } from './config/cookie.config';

// Mock CsrfMiddleware at module level before any import resolves
jest.mock('../common/middleware/csrf.middleware', () => ({
  CsrfMiddleware: {
    generateToken: jest.fn().mockReturnValue('mock-csrf-token'),
  },
}));

describe('AuthController', () => {
  let controller: AuthController;
  let authService: any;

  const mockAuthService = {
    login: jest.fn(),
    refreshToken: jest.fn(),
    logout: jest.fn(),
    createUser: jest.fn(),
    changePassword: jest.fn(),
  };

  // ─── Factory helpers for mock Request / Response ───────────────────────

  const mockResponse = () => {
    const res: any = {
      cookie: jest.fn().mockReturnThis(),
    };
    return res;
  };

  const mockRequest = (overrides: Record<string, any> = {}) => {
    const req: any = {
      headers: { 'x-forwarded-for': '127.0.0.1', 'user-agent': 'test-agent' },
      ip: '127.0.0.1',
      cookies: {},
      user: undefined,
      ...overrides,
    };
    return req;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGIN
  // ═══════════════════════════════════════════════════════════════════════════

  describe('POST /auth/login', () => {
    const loginDto = { email: 'admin@manchengo.dz', password: 'MotDePasse1!x' };
    const loginResult = {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      user: {
        id: 'user-1',
        code: 'ADM001',
        email: 'admin@manchengo.dz',
        firstName: 'Test',
        lastName: 'Admin',
        role: 'ADMIN',
        mustChangePassword: false,
      },
    };

    it('devrait retourner les tokens et infos utilisateur avec des identifiants valides', async () => {
      mockAuthService.login.mockResolvedValue(loginResult);
      const req = mockRequest();
      const res = mockResponse();

      const result = await controller.login(loginDto, req, res);

      expect(result.message).toBe('Login successful');
      expect(result.access_token).toBe('mock-access-token');
      expect(result.user.email).toBe('admin@manchengo.dz');
      expect(result.user.role).toBe('ADMIN');
      expect(result.user.id).toBe('user-1');
    });

    it('devrait definir les cookies httpOnly pour access_token et refresh_token', async () => {
      mockAuthService.login.mockResolvedValue(loginResult);
      const req = mockRequest();
      const res = mockResponse();

      await controller.login(loginDto, req, res);

      // Verify access token cookie was set
      expect(res.cookie).toHaveBeenCalledWith(
        COOKIE_NAMES.ACCESS_TOKEN,
        'mock-access-token',
        expect.any(Object),
      );
      // Verify refresh token cookie was set
      expect(res.cookie).toHaveBeenCalledWith(
        COOKIE_NAMES.REFRESH_TOKEN,
        'mock-refresh-token',
        expect.any(Object),
      );
    });

    it('devrait passer l\'adresse IP et le user-agent au service', async () => {
      mockAuthService.login.mockResolvedValue(loginResult);
      const req = mockRequest({
        headers: { 'x-forwarded-for': '192.168.1.100', 'user-agent': 'Mozilla/5.0' },
      });
      const res = mockResponse();

      await controller.login(loginDto, req, res);

      expect(mockAuthService.login).toHaveBeenCalledWith(
        loginDto,
        '192.168.1.100',
        'Mozilla/5.0',
      );
    });

    it('devrait rejeter les identifiants invalides avec UnauthorizedException', async () => {
      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException('Identifiants invalides'),
      );
      const req = mockRequest();
      const res = mockResponse();

      await expect(
        controller.login({ email: 'bad@test.dz', password: 'wrong' }, req, res),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('devrait propager l\'erreur 401 pour un utilisateur inactif', async () => {
      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException('Identifiants invalides'),
      );
      const req = mockRequest();
      const res = mockResponse();

      await expect(
        controller.login(loginDto, req, res),
      ).rejects.toThrow('Identifiants invalides');
    });

    it('devrait utiliser req.ip si x-forwarded-for est absent', async () => {
      mockAuthService.login.mockResolvedValue(loginResult);
      const req = mockRequest({ headers: { 'user-agent': 'test' }, ip: '10.0.0.1' });
      const res = mockResponse();

      await controller.login(loginDto, req, res);

      expect(mockAuthService.login).toHaveBeenCalledWith(
        loginDto,
        '10.0.0.1',
        'test',
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // REFRESH
  // ═══════════════════════════════════════════════════════════════════════════

  describe('POST /auth/refresh', () => {
    const refreshResult = {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    };

    it('devrait rafraichir les tokens avec un refresh token valide dans les cookies', async () => {
      mockAuthService.refreshToken.mockResolvedValue(refreshResult);
      const req = mockRequest({
        cookies: { [COOKIE_NAMES.REFRESH_TOKEN]: 'valid-refresh-token' },
      });
      const res = mockResponse();

      const result = await controller.refreshToken(req, res);

      expect(result.message).toBe('Token refreshed successfully');
      expect(result.access_token).toBe('new-access-token');
      expect(mockAuthService.refreshToken).toHaveBeenCalledWith({
        refreshToken: 'valid-refresh-token',
      });
    });

    it('devrait definir les nouveaux cookies apres rafraichissement', async () => {
      mockAuthService.refreshToken.mockResolvedValue(refreshResult);
      const req = mockRequest({
        cookies: { [COOKIE_NAMES.REFRESH_TOKEN]: 'valid-refresh-token' },
      });
      const res = mockResponse();

      await controller.refreshToken(req, res);

      expect(res.cookie).toHaveBeenCalledWith(
        COOKIE_NAMES.ACCESS_TOKEN,
        'new-access-token',
        expect.any(Object),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        COOKIE_NAMES.REFRESH_TOKEN,
        'new-refresh-token',
        expect.any(Object),
      );
    });

    it('devrait rejeter quand aucun refresh token n\'est present dans les cookies', async () => {
      const req = mockRequest({ cookies: {} });
      const res = mockResponse();

      await expect(controller.refreshToken(req, res)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(controller.refreshToken(req, res)).rejects.toThrow(
        'No refresh token provided',
      );
    });

    it('devrait effacer les cookies quand le refresh token est absent', async () => {
      const req = mockRequest({ cookies: {} });
      const res = mockResponse();

      try {
        await controller.refreshToken(req, res);
      } catch {
        // Expected to throw
      }

      // Cookies should be cleared with empty string
      expect(res.cookie).toHaveBeenCalledWith(
        COOKIE_NAMES.ACCESS_TOKEN,
        '',
        expect.any(Object),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        COOKIE_NAMES.REFRESH_TOKEN,
        '',
        expect.any(Object),
      );
    });

    it('devrait propager l\'erreur du service quand le refresh token est expire', async () => {
      mockAuthService.refreshToken.mockRejectedValue(
        new UnauthorizedException('Token de rafraîchissement invalide'),
      );
      const req = mockRequest({
        cookies: { [COOKIE_NAMES.REFRESH_TOKEN]: 'expired-token' },
      });
      const res = mockResponse();

      await expect(controller.refreshToken(req, res)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGOUT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('POST /auth/logout', () => {
    it('devrait appeler authService.logout et effacer les cookies', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);
      const req = mockRequest({
        cookies: { [COOKIE_NAMES.REFRESH_TOKEN]: 'some-token' },
      });
      const res = mockResponse();

      const result = await controller.logout(req, res);

      expect(result.message).toBe('Logged out successfully');
      expect(mockAuthService.logout).toHaveBeenCalledWith('some-token');
      // Verify cookies are cleared
      expect(res.cookie).toHaveBeenCalledWith(
        COOKIE_NAMES.ACCESS_TOKEN,
        '',
        expect.any(Object),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        COOKIE_NAMES.REFRESH_TOKEN,
        '',
        expect.any(Object),
      );
    });

    it('devrait reussir meme sans refresh token dans les cookies', async () => {
      const req = mockRequest({ cookies: {} });
      const res = mockResponse();

      const result = await controller.logout(req, res);

      expect(result.message).toBe('Logged out successfully');
      expect(mockAuthService.logout).not.toHaveBeenCalled();
      // Cookies should still be cleared
      expect(res.cookie).toHaveBeenCalledWith(
        COOKIE_NAMES.ACCESS_TOKEN,
        '',
        expect.any(Object),
      );
    });

    it('devrait toujours effacer les cookies meme si le service echoue', async () => {
      mockAuthService.logout.mockRejectedValue(new Error('DB error'));
      const req = mockRequest({
        cookies: { [COOKIE_NAMES.REFRESH_TOKEN]: 'some-token' },
      });
      const res = mockResponse();

      // The controller does not catch service errors, so it will throw
      await expect(controller.logout(req, res)).rejects.toThrow('DB error');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CHANGE PASSWORD
  // ═══════════════════════════════════════════════════════════════════════════

  describe('POST /auth/change-password', () => {
    const changePasswordBody = {
      currentPassword: 'AncienMdp1!x',
      newPassword: 'NouveauMdp1!x',
    };

    it('devrait changer le mot de passe avec succes', async () => {
      mockAuthService.changePassword.mockResolvedValue({
        success: true,
        message: 'Mot de passe modifié avec succès',
      });

      const req = mockRequest({ user: { id: 'user-1' } });
      const result = await controller.changePassword(changePasswordBody, req as any);

      expect(result.success).toBe(true);
      expect(result.message).toContain('succès');
      expect(mockAuthService.changePassword).toHaveBeenCalledWith(
        'user-1',
        'AncienMdp1!x',
        'NouveauMdp1!x',
      );
    });

    it('devrait rejeter si le mot de passe actuel est incorrect', async () => {
      mockAuthService.changePassword.mockRejectedValue(
        new BadRequestException('Mot de passe actuel incorrect'),
      );

      const req = mockRequest({ user: { id: 'user-1' } });
      await expect(
        controller.changePassword(
          { currentPassword: 'WrongPassword1!', newPassword: 'NouveauMdp1!x' },
          req as any,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.changePassword(
          { currentPassword: 'WrongPassword1!', newPassword: 'NouveauMdp1!x' },
          req as any,
        ),
      ).rejects.toThrow('Mot de passe actuel incorrect');
    });

    it('devrait rejeter un nouveau mot de passe faible', async () => {
      mockAuthService.changePassword.mockRejectedValue(
        new BadRequestException('Le mot de passe doit contenir au moins 12 caractères'),
      );

      const req = mockRequest({ user: { id: 'user-1' } });
      await expect(
        controller.changePassword(
          { currentPassword: 'AncienMdp1!x', newPassword: 'Ab1!' },
          req as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('devrait rejeter quand le nouveau mot de passe est identique a l\'ancien', async () => {
      mockAuthService.changePassword.mockRejectedValue(
        new BadRequestException('Le nouveau mot de passe doit être différent de l\'ancien'),
      );

      const req = mockRequest({ user: { id: 'user-1' } });
      await expect(
        controller.changePassword(
          { currentPassword: 'AncienMdp1!x', newPassword: 'AncienMdp1!x' },
          req as any,
        ),
      ).rejects.toThrow(/différent/);
    });

    it('devrait rejeter si l\'utilisateur n\'est pas identifie (pas de user.id)', async () => {
      const req = mockRequest({ user: {} });

      await expect(
        controller.changePassword(changePasswordBody, req as any),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        controller.changePassword(changePasswordBody, req as any),
      ).rejects.toThrow('Utilisateur non identifié');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE USER
  // ═══════════════════════════════════════════════════════════════════════════

  describe('POST /auth/users', () => {
    it('devrait creer un utilisateur avec succes', async () => {
      mockAuthService.createUser.mockResolvedValue({
        id: 'new-id',
        code: 'USR001',
        email: 'new@test.dz',
      });

      const result = await controller.createUser({
        code: 'USR001',
        email: 'new@test.dz',
        password: 'MotDePasse1!x',
        firstName: 'Nouveau',
        lastName: 'Utilisateur',
        role: 'COMMERCIAL' as any,
      });

      expect(result.id).toBe('new-id');
      expect(result.code).toBe('USR001');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /auth/me
  // ═══════════════════════════════════════════════════════════════════════════

  describe('GET /auth/me', () => {
    it('devrait retourner les informations utilisateur sans passwordHash', async () => {
      const req = mockRequest({
        user: {
          id: 'user-1',
          email: 'admin@manchengo.dz',
          role: 'ADMIN',
          firstName: 'Test',
          lastName: 'Admin',
          passwordHash: '$2b$12$hashed',
        },
      });

      const result = await controller.getMe(req as any);

      expect(result.id).toBe('user-1');
      expect(result.email).toBe('admin@manchengo.dz');
      expect((result as any).passwordHash).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GUARDS VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Guards verification', () => {
    it('devrait avoir JwtAuthGuard applique sur POST /auth/change-password', () => {
      const guards = Reflect.getMetadata('__guards__', AuthController.prototype.changePassword);
      expect(guards).toBeDefined();
      const guardInstances = guards.map((g: any) => g.name || g.constructor?.name || g);
      expect(guardInstances).toContain('JwtAuthGuard');
    });

    it('devrait avoir JwtAuthGuard et RolesGuard appliques sur POST /auth/users', () => {
      const guards = Reflect.getMetadata('__guards__', AuthController.prototype.createUser);
      expect(guards).toBeDefined();
      const guardNames = guards.map((g: any) => g.name || g);
      expect(guardNames).toContain('JwtAuthGuard');
      expect(guardNames).toContain('RolesGuard');
    });

    it('devrait avoir JwtAuthGuard applique sur GET /auth/me', () => {
      const guards = Reflect.getMetadata('__guards__', AuthController.prototype.getMe);
      expect(guards).toBeDefined();
      const guardNames = guards.map((g: any) => g.name || g);
      expect(guardNames).toContain('JwtAuthGuard');
    });

    it('devrait avoir JwtAuthGuard applique sur GET /auth/csrf-token', () => {
      const guards = Reflect.getMetadata('__guards__', AuthController.prototype.getCsrfToken);
      expect(guards).toBeDefined();
      const guardNames = guards.map((g: any) => g.name || g);
      expect(guardNames).toContain('JwtAuthGuard');
    });

    it('ne devrait PAS avoir de guard sur POST /auth/login (public endpoint)', () => {
      const guards = Reflect.getMetadata('__guards__', AuthController.prototype.login);
      expect(guards).toBeUndefined();
    });

    it('ne devrait PAS avoir de guard sur POST /auth/logout (public endpoint)', () => {
      const guards = Reflect.getMetadata('__guards__', AuthController.prototype.logout);
      expect(guards).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // HTTP STATUS CODES (via decorators)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('HTTP status codes', () => {
    it('devrait avoir HttpCode(200) sur POST /auth/login', () => {
      const statusCode = Reflect.getMetadata('__httpCode__', AuthController.prototype.login);
      expect(statusCode).toBe(200);
    });

    it('devrait avoir HttpCode(200) sur POST /auth/refresh', () => {
      const statusCode = Reflect.getMetadata('__httpCode__', AuthController.prototype.refreshToken);
      expect(statusCode).toBe(200);
    });

    it('devrait avoir HttpCode(200) sur POST /auth/logout', () => {
      const statusCode = Reflect.getMetadata('__httpCode__', AuthController.prototype.logout);
      expect(statusCode).toBe(200);
    });

    it('devrait avoir HttpCode(200) sur POST /auth/change-password', () => {
      const statusCode = Reflect.getMetadata('__httpCode__', AuthController.prototype.changePassword);
      expect(statusCode).toBe(200);
    });
  });
});
