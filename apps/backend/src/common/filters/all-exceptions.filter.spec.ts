/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ALL EXCEPTIONS FILTER TESTS - Gestion globale des erreurs
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * INVARIANTS TESTES:
 * 1. HttpException retourne le bon status code
 * 2. Erreurs de validation formatees correctement (tableau de messages)
 * 3. Erreurs inconnues retournent 500
 * 4. Mode production masque les messages d'erreur internes
 * 5. Erreur avec reponse string
 * 6. Log structure pour les erreurs 5xx
 * 7. requestId present dans la reponse
 */

import {
  HttpException,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: any;

  beforeEach(() => {
    filter = new AllExceptionsFilter();

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      method: 'POST',
      url: '/api/auth/login',
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'Jest/Test',
        'x-request-id': 'req-test-123',
      },
      socket: { remoteAddress: '127.0.0.1' },
      user: { sub: 'user-1' },
    };

    mockHost = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    };

    // Default: mode non-production
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // HTTP EXCEPTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('HttpException retourne le bon status', () => {
    it('devrait retourner 400 pour BadRequestException', () => {
      filter.catch(new BadRequestException('Donnee invalide'), mockHost as any);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: 400,
        }),
      );
    });

    it('devrait retourner 401 pour UnauthorizedException', () => {
      filter.catch(new UnauthorizedException('Non autorise'), mockHost as any);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: 401,
        }),
      );
    });

    it('devrait retourner 403 pour ForbiddenException', () => {
      filter.catch(new ForbiddenException('Acces refuse'), mockHost as any);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('devrait retourner 404 pour NotFoundException', () => {
      filter.catch(new NotFoundException('Ressource introuvable'), mockHost as any);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('devrait retourner un status personnalise pour HttpException generique', () => {
      filter.catch(new HttpException('Conflit', HttpStatus.CONFLICT), mockHost as any);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ERREURS DE VALIDATION (class-validator)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Erreurs de validation formatees', () => {
    it('devrait joindre les messages de validation en une seule chaine', () => {
      const validationException = new BadRequestException({
        statusCode: 400,
        message: ['email doit etre un email', 'password est requis'],
        error: 'Bad Request',
      });

      filter.catch(validationException, mockHost as any);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'email doit etre un email, password est requis',
          statusCode: 400,
        }),
      );
    });

    it('devrait gerer une reponse d\'erreur sous forme de string', () => {
      const exception = new HttpException('Erreur simple', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost as any);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Erreur simple',
          statusCode: 400,
        }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ERREURS INCONNUES (non-HTTP)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Erreurs inconnues retournent 500', () => {
    it('devrait retourner 500 pour une Error standard', () => {
      filter.catch(new Error('Quelque chose a casse'), mockHost as any);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: 500,
          error: 'Internal Server Error',
        }),
      );
    });

    it('devrait retourner 500 pour une exception de type inconnu (string)', () => {
      filter.catch('erreur brute', mockHost as any);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          message: 'Unknown error occurred',
        }),
      );
    });

    it('devrait retourner 500 pour null/undefined', () => {
      filter.catch(null, mockHost as any);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MODE PRODUCTION: MASQUAGE DES DETAILS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Mode production masque les erreurs internes', () => {
    it('devrait masquer le message d\'erreur en production pour les erreurs 500', () => {
      process.env.NODE_ENV = 'production';

      filter.catch(new Error('Stack trace detaille interne'), mockHost as any);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          message: expect.stringContaining('erreur interne'),
        }),
      );
      // Ne doit PAS contenir le vrai message d'erreur
      const jsonCall = mockResponse.json.mock.calls[0][0];
      expect(jsonCall.message).not.toContain('Stack trace');
    });

    it('devrait afficher le vrai message en production pour les erreurs 4xx', () => {
      process.env.NODE_ENV = 'production';

      filter.catch(new BadRequestException('Email invalide'), mockHost as any);

      const jsonCall = mockResponse.json.mock.calls[0][0];
      expect(jsonCall.message).toContain('Email invalide');
    });

    it('devrait afficher le vrai message en developpement pour les erreurs 500', () => {
      process.env.NODE_ENV = 'development';

      filter.catch(new Error('Detail visible en dev'), mockHost as any);

      const jsonCall = mockResponse.json.mock.calls[0][0];
      expect(jsonCall.message).toContain('Detail visible en dev');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STRUCTURE DE REPONSE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Structure de reponse', () => {
    it('devrait inclure requestId dans la reponse', () => {
      filter.catch(new BadRequestException('test'), mockHost as any);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'req-test-123',
        }),
      );
    });

    it('devrait inclure le path dans la reponse', () => {
      filter.catch(new BadRequestException('test'), mockHost as any);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/api/auth/login',
        }),
      );
    });

    it('devrait inclure timestamp dans la reponse', () => {
      filter.catch(new BadRequestException('test'), mockHost as any);

      const jsonCall = mockResponse.json.mock.calls[0][0];
      expect(jsonCall.timestamp).toBeDefined();
      // Verifier que c'est un format ISO
      expect(new Date(jsonCall.timestamp).toISOString()).toBe(jsonCall.timestamp);
    });

    it('devrait inclure success: false dans la reponse', () => {
      filter.catch(new BadRequestException('test'), mockHost as any);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        }),
      );
    });

    it('devrait utiliser "unknown" comme requestId si aucun header x-request-id', () => {
      mockRequest.headers = { 'user-agent': 'Jest/Test' };
      delete mockRequest.id;

      filter.catch(new BadRequestException('test'), mockHost as any);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'unknown',
        }),
      );
    });
  });
});
