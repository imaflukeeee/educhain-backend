import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [StudentsController],
  providers: [StudentsService],
})
export class StudentsModule {}
