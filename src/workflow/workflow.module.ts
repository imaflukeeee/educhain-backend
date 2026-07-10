import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SecurityModule } from '../security/security.module';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';

@Module({
  imports: [PrismaModule, SecurityModule],
  controllers: [WorkflowController],
  providers: [WorkflowService],
})
export class WorkflowModule {}
