import { Module } from '@nestjs/common';
import { DemandesMpController } from './demandes-mp.controller';
import { DemandesMpService } from './demandes-mp.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DemandesMpController],
  providers: [DemandesMpService],
  exports: [DemandesMpService],
})
export class DemandesMpModule {}
