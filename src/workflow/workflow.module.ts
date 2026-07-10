import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';

@Module({
  imports: [PrismaModule],
  controllers: [WorkflowController],
  providers: [WorkflowService],
})
export class WorkflowModule {}
