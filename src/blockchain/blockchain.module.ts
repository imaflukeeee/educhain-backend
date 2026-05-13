import { Module } from '@nestjs/common';
import { BlockchainController } from './blockchain.controller';
import { BlockchainService } from './blockchain.service';

/**
 * BlockchainModule ดูแลการเชื่อมต่อ Blockchain
 * เช่น Polygon Amoy, Smart Contract และ Transaction
 */
@Module({
  controllers: [BlockchainController],
  providers: [BlockchainService],
  exports: [BlockchainService],
})
export class BlockchainModule {}
