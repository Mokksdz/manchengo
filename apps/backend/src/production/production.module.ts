import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StockModule } from '../stock/stock.module';
import { ApproModule } from '../appro/appro.module';
import { PurchaseOrderModule } from '../appro/purchase-orders/purchase-order.module';
import { RecipeService } from './recipe.service';
import { RecipeController } from './recipe.controller';
import { ProductionService } from './production.service';
import { ProductionController } from './production.controller';
import { ProductionSupplyRisksService } from './production-supply-risks.service';

@Module({
  imports: [
    PrismaModule, 
    StockModule, 
    forwardRef(() => ApproModule),
    forwardRef(() => PurchaseOrderModule),
  ],
  controllers: [RecipeController, ProductionController],
  providers: [RecipeService, ProductionService, ProductionSupplyRisksService],
  exports: [RecipeService, ProductionService, ProductionSupplyRisksService],
})
export class ProductionModule {}
