import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { logger } from './common/logger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

/**
 * Validate required environment variables at startup.
 * Fail fast if critical configuration is missing.
 */
function validateEnv() {
  const isProduction = process.env.NODE_ENV === 'production';
  const required: string[] = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'QR_SECRET_KEY'];

  // Production requires Redis for distributed rate limiting
  if (isProduction) {
    required.push('REDIS_HOST', 'REDIS_PASSWORD');
  }

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `FATAL: Missing required environment variables: ${missing.join(', ')}. ` +
      `Application cannot start. Check your .env file or environment configuration.`,
    );
  }

  // Fail hard on insecure defaults in production
  if (isProduction) {
    const insecureDefaults: Record<string, string> = {
      JWT_SECRET: 'your-super-secret-jwt-key-change-in-production-min-32-chars',
      JWT_REFRESH_SECRET: 'your-super-secret-refresh-key-change-in-production-min-32-chars',
      QR_SECRET_KEY: 'MCG_QR_SECRET_2024_PROD',
    };
    for (const [key, defaultVal] of Object.entries(insecureDefaults)) {
      if (process.env[key] === defaultVal) {
        throw new Error(
          `SECURITY: ${key} is still set to the default value. ` +
          `Change it before deploying to production!`,
        );
      }
    }

    // Enforce minimum secret length
    if (process.env.JWT_SECRET!.length < 32) {
      throw new Error('SECURITY: JWT_SECRET must be at least 32 characters in production.');
    }
    if (process.env.JWT_REFRESH_SECRET!.length < 32) {
      throw new Error('SECURITY: JWT_REFRESH_SECRET must be at least 32 characters in production.');
    }
  }
}

async function bootstrap() {
  // Validate environment before creating the app
  validateEnv();

  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api');

  // ═══════════════════════════════════════════════════════════════════════════
  // SECURITY HEADERS - Helmet
  // ═══════════════════════════════════════════════════════════════════════════
  const isProduction = process.env.NODE_ENV === 'production';
  
  app.use(
    helmet({
      // XSS Protection
      xssFilter: true,
      // Prevent MIME type sniffing
      noSniff: true,
      // Clickjacking protection
      frameguard: { action: 'deny' },
      // HSTS - only in production (requires HTTPS)
      hsts: isProduction
        ? {
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true,
          }
        : false,
      // Content Security Policy - adjust as needed
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              styleSrc: ["'self'"],
              scriptSrc: ["'self'"],
              imgSrc: ["'self'", 'data:', 'blob:'],
              connectSrc: ["'self'"],
              fontSrc: ["'self'"],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
            },
          }
        : false,
    }),
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // COOKIE PARSER - Required for httpOnly cookies
  // ═══════════════════════════════════════════════════════════════════════════
  app.use(cookieParser());

  // ═══════════════════════════════════════════════════════════════════════════
  // CORS - Whitelist production origins
  // ═══════════════════════════════════════════════════════════════════════════
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : [
        'http://localhost:3001',
        'http://localhost:3000',
        /^http:\/\/127\.0\.0\.1:\d+$/, // Allow all 127.0.0.1 ports in dev
      ];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }
      // Check if origin is in whitelist (supports both strings and RegExp)
      if (allowedOrigins.some(o => o instanceof RegExp ? o.test(origin) : o === origin)) {
        return callback(null, true);
      }
      // In development, allow localhost and 127.0.0.1 variants
      if (!isProduction && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        return callback(null, true);
      }
      // Block all other origins
      return callback(new Error('CORS policy violation'), false);
    },
    credentials: true, // Required for cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'X-CSRF-Token'],
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GLOBAL EXCEPTION FILTER - R2 + R4: Structured error monitoring & logging
  // ═══════════════════════════════════════════════════════════════════════════
  app.useGlobalFilters(new AllExceptionsFilter());

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // R16: SWAGGER - Complete API Documentation
  // SECURITY: Disabled in production unless SWAGGER_ENABLED=true
  // ═══════════════════════════════════════════════════════════════════════════
  const swaggerEnabled = !isProduction || process.env.SWAGGER_ENABLED === 'true';
  const config = new DocumentBuilder()
    .setTitle('Manchengo Smart ERP API')
    .setDescription(
      `## API Backend pour Manchengo Smart ERP

**ERP agro-industriel offline-first pour laiteries algériennes**

### Modules:
- **Auth**: Authentification JWT, gestion utilisateurs, changement mot de passe
- **Dashboard**: KPIs, graphiques ventes/production, dashboard par rôle
- **Stock**: Gestion stock MP/PF, mouvements, lots, DLC, FIFO
- **Production**: Ordres de production, recettes, consommation matières
- **Delivery**: Validation livraison par QR code, preuve de livraison
- **Appro**: Demandes approvisionnement, bons de commande, alertes
- **Monitoring**: KPIs système, alertes, health checks
- **Exports**: Export Excel/PDF (ventes, journal TVA, stock)
- **Security**: Gestion utilisateurs, appareils, audit trail
- **Health**: Checks de santé (DB, Redis, mémoire)

### Authentification:
Tous les endpoints (sauf /health et /auth/login) nécessitent un token JWT Bearer.
Les tokens sont aussi envoyés via cookies httpOnly.

### Rôles:
- **ADMIN**: Accès complet
- **APPRO**: Approvisionnement, stock MP
- **PRODUCTION**: Production, stock, recettes
- **COMMERCIAL**: Ventes, clients, livraisons
`,
    )
    .setVersion('1.0.0')
    .setContact('Manchengo Smart ERP', '', 'admin@manchengo.dz')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token',
      },
      'bearer',
    )
    .addTag('Auth', 'Authentication & user management')
    .addTag('Dashboard', 'KPIs & charts')
    .addTag('Stock', 'Stock management (MP, PF, lots)')
    .addTag('Production', 'Production orders & recipes')
    .addTag('Deliveries', 'QR validation & delivery tracking')
    .addTag('Appro', 'Procurement & purchase orders')
    .addTag('Monitoring', 'System monitoring & alerts')
    .addTag('Exports', 'Excel/PDF exports')
    .addTag('Health', 'Health checks')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  if (!swaggerEnabled) {
    logger.warn('Swagger docs DISABLED in production (set SWAGGER_ENABLED=true to override)', 'Bootstrap');
  }
  if (swaggerEnabled) SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'Manchengo ERP API Docs',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  
  logger.info(`Manchengo API running on http://localhost:${port}`, 'Bootstrap');
  logger.info(`Swagger docs at http://localhost:${port}/docs`, 'Bootstrap');
  logger.info(`Security: Helmet=true, CORS=${allowedOrigins.join(',')}, Cookies=true`, 'Bootstrap');
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`, 'Bootstrap');
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('FATAL: Bootstrap failed:', err);
  process.exit(1);
});
