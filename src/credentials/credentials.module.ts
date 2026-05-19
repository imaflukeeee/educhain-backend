import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { CredentialsController } from './credentials.controller';
import { CredentialsService } from './credentials.service';

/**
 * CredentialsModule ดูแลการออกเอกสาร VC เบื้องต้น
 * เช่น Upload PDF, Generate Hash, บันทึก Metadata และบันทึกลง Blockchain
 */
@Module({
  imports: [
    PrismaModule,
    StorageModule,
    AuthModule,

    /**
     * ใช้ BlockchainService สำหรับบันทึก documentHash ลง Smart Contract
     */
    BlockchainModule,
  ],
  controllers: [CredentialsController],
  providers: [CredentialsService],
})
export class CredentialsModule {}
