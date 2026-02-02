import { Global, Module } from '@nestjs/common';
import { LoggerService } from './logger.service';

/**
 * Global Logger Module
 * 
 * WHY Global: Every module needs logging. Making it global avoids
 * importing LoggerModule in every feature module.
 */
@Global()
@Module({
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}
