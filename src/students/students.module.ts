import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SecurityModule } from '../security/security.module';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  imports: [PrismaModule, SecurityModule],
  controllers: [StudentsController],
  providers: [StudentsService],
})
export class StudentsModule {}
