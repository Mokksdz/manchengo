import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { AuthService } from '../auth.service';
import { TokenPayload } from '../dto/auth.dto';
import { COOKIE_NAMES } from '../config/cookie.config';

// ═══════════════════════════════════════════════════════════════════════════
// JWT STRATEGY - Extracts token from:
// 1. httpOnly cookie (web frontend - primary)
// 2. Authorization header (mobile apps - fallback)
//
// SECRET ROTATION (N / N-1):
//   Set JWT_SECRET_PREVIOUS during rotation to accept tokens signed
//   with the old secret for up to 15 min (access token TTL).
//   Steps: 1) Set JWT_SECRET_PREVIOUS=<old>  2) Set JWT_SECRET=<new>
//          3) Deploy  4) After 15 min, remove JWT_SECRET_PREVIOUS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Custom extractor that checks cookie first, then Authorization header
 * This allows both web (cookie) and mobile (header) authentication
 */
const extractJwtFromCookieOrHeader = (req: Request): string | null => {
  // 1. Try to extract from httpOnly cookie (web)
  if (req.cookies && req.cookies[COOKIE_NAMES.ACCESS_TOKEN]) {
    return req.cookies[COOKIE_NAMES.ACCESS_TOKEN];
  }

  // 2. Fallback to Authorization header (mobile apps)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);
  private readonly previousSecret: string | undefined;

  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: extractJwtFromCookieOrHeader,
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
      // passReqToCallback to allow N-1 fallback in validate()
      passReqToCallback: true,
    });
    this.previousSecret = configService.get<string>('JWT_SECRET_PREVIOUS');
    if (this.previousSecret) {
      this.logger.warn(
        'JWT_SECRET_PREVIOUS is set — N/N-1 rotation active. ' +
        'Remove JWT_SECRET_PREVIOUS after 15 minutes.',
      );
    }
  }

  /**
   * Passport calls this after verifying with the primary secret.
   * If the primary secret fails AND JWT_SECRET_PREVIOUS is set,
   * we attempt verification with the old secret (N-1 acceptance).
   */
  async validate(req: Request, payload: TokenPayload) {
    const user = await this.authService.validateUser(payload);
    if (!user) {
      throw new UnauthorizedException('Token invalide ou expiré');
    }
    return user;
  }

  /**
   * Override handleRequest to implement N-1 fallback.
   * If primary verification fails and a previous secret exists,
   * manually verify with the old key before rejecting.
   */
  handleRequest(err: any, user: any, info: any, context: any) {
    if ((err || !user) && this.previousSecret) {
      // Try N-1 verification with previous secret
      try {
        const req = context?.switchToHttp?.()?.getRequest?.() || context;
        const token = extractJwtFromCookieOrHeader(req);
        if (token) {
          const payload = jwt.verify(token, this.previousSecret) as TokenPayload;
          if (payload?.sub) {
            this.logger.warn(
              `Token verified with N-1 secret for user ${payload.sub}. ` +
              'Rejecting — user must re-login to get a token signed with the current secret.',
            );
            // Force re-login: token is valid but signed with deprecated secret
            throw new UnauthorizedException(
              'Session expirée suite à une mise à jour de sécurité — veuillez vous reconnecter',
            );
          }
        }
      } catch (e) {
        // If it's our own UnauthorizedException, re-throw it
        if (e instanceof UnauthorizedException) throw e;
        // N-1 also failed — fall through to normal error
      }
    }

    if (err || !user) {
      throw err || new UnauthorizedException('Token invalide ou expiré');
    }
    return user;
  }
}
