import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { Phase3Controller } from './phase3.controller';
import { Phase3Service } from './phase3.service';

@Module({
  imports: [PrismaModule],
  controllers: [Phase3Controller],
  providers: [Phase3Service],
})
export class Phase3Module {}
