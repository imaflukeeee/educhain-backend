import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { CredentialsController } from './credentials.controller';
import { CredentialsService } from './credentials.service';

/**
 * CredentialsModule ดูแลการออกเอกสาร VC เบื้องต้น
 * เช่น Upload PDF, Generate Hash และบันทึก Metadata
 */
@Module({
  imports: [
    PrismaModule,
    StorageModule,

    /**
     * ต้อง import AuthModule
     * เพราะ CredentialsController ใช้ JwtAuthGuard และ RolesGuard
     */
    AuthModule,
  ],
  controllers: [CredentialsController],
  providers: [CredentialsService],
})
export class CredentialsModule {}