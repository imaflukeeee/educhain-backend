import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { UniversitiesController } from './universities.controller';
import { UniversitiesService } from './universities.service';
@Module({ imports: [PrismaModule, AuthModule], controllers: [UniversitiesController], providers: [UniversitiesService], exports: [UniversitiesService] })
export class UniversitiesModule {}
