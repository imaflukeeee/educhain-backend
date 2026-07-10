import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SecurityModule } from '../security/security.module';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';

/**
 * OperationsModule ดูแล Dashboard, Notification และ Audit activity
 */
@Module({
  imports: [PrismaModule, SecurityModule],
  controllers: [OperationsController],
  providers: [OperationsService],
})
export class OperationsModule {}
