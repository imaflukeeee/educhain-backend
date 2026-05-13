import { Controller, Get } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';

@Controller('blockchain')
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) {}

  /**
   * GET /blockchain/status
   * ใช้ตรวจสอบว่า Backend เชื่อมกับ Polygon Amoy และ Smart Contract ได้ไหม
   */
  @Get('status')
  getStatus() {
    return this.blockchainService.getBlockchainStatus();
  }
}
