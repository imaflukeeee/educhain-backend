import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CredentialsModule } from './credentials/credentials.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { UsersModule } from './users/users.module';
import { BlockchainModule } from './blockchain/blockchain.module';

/**
 * AppModule คือ Module หลักของ Backend
 */
@Module({
  imports: [
    /**
     * โหลด .env ให้ใช้ได้ทั้งระบบ
     */
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    PrismaModule,
    StorageModule,
    UsersModule,
    AuthModule,
    CredentialsModule,
    BlockchainModule,
  ],
})
export class AppModule {}
