import 'dotenv/config';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ethers } from 'ethers';
import { credentialRegistryAbi } from './abis/credential-registry.abi';

/**
 * BlockchainService ใช้เชื่อมต่อ Polygon Amoy Testnet
 * และเรียกใช้งาน Smart Contract ของ EduChain
 */
@Injectable()
export class BlockchainService {
  private readonly provider: ethers.JsonRpcProvider;
  private readonly wallet: ethers.Wallet;
  private readonly contract: ethers.Contract;
  private readonly contractAddress: string;
  private readonly networkName: string;

  constructor() {
    const rpcUrl = process.env.AMOY_RPC_URL;
    const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;
    const contractAddress = process.env.CONTRACT_ADDRESS;
    const networkName = process.env.BLOCKCHAIN_NETWORK ?? 'Polygon Amoy';

    if (!rpcUrl) {
      throw new InternalServerErrorException(
        'กรุณาตั้งค่า AMOY_RPC_URL ในไฟล์ .env',
      );
    }

    if (!privateKey) {
      throw new InternalServerErrorException(
        'กรุณาตั้งค่า BLOCKCHAIN_PRIVATE_KEY ในไฟล์ .env',
      );
    }

    if (!contractAddress) {
      throw new InternalServerErrorException(
        'กรุณาตั้งค่า CONTRACT_ADDRESS ในไฟล์ .env',
      );
    }

    /**
     * Provider ใช้เชื่อมต่อ RPC ของ Polygon Amoy
     */
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    /**
     * Wallet ใช้สำหรับส่ง Transaction
     * Private Key ต้องอยู่ใน .env เท่านั้น
     */
    this.wallet = new ethers.Wallet(privateKey, this.provider);

    this.contractAddress = contractAddress;
    this.networkName = networkName;

    /**
     * Contract Instance สำหรับเรียก Smart Contract
     */
    this.contract = new ethers.Contract(
      this.contractAddress,
      credentialRegistryAbi,
      this.wallet,
    );
  }

  /**
   * ใช้ตรวจสอบว่า Backend เชื่อม Blockchain ได้ไหม
   */
  async getBlockchainStatus() {
    try {
      const network = await this.provider.getNetwork();
      const walletAddress = await this.wallet.getAddress();
      const balance = await this.provider.getBalance(walletAddress);
      const contractCode = await this.provider.getCode(this.contractAddress);

      const isContractDeployed = contractCode !== '0x';

      return {
        message: 'เชื่อมต่อ Blockchain สำเร็จ',
        network: this.networkName,
        chainId: Number(network.chainId),
        walletAddress,
        walletBalance: ethers.formatEther(balance),
        contractAddress: this.contractAddress,
        isContractDeployed,
      };
    } catch {
      throw new InternalServerErrorException(
        'เชื่อมต่อ Blockchain ไม่สำเร็จ กรุณาตรวจสอบ RPC URL, Private Key หรือ Contract Address',
      );
    }
  }

  /**
   * บันทึกข้อมูล Credential ลง Smart Contract
   */
  async registerCredentialOnChain(params: {
    credentialId: string;
    documentHash: string;
    holderAddress: string;
  }): Promise<{
    transactionHash: string;
    blockNumber: number;
    network: string;
  }> {
    const { credentialId, documentHash, holderAddress } = params;

    if (!ethers.isAddress(holderAddress)) {
      throw new BadRequestException('Wallet Address ของ Holder ไม่ถูกต้อง');
    }

    try {
      /**
       * ตรวจสอบก่อนว่า credentialId นี้เคยถูกบันทึกบน Blockchain แล้วหรือยัง
       */
      const exists = (await this.contract.credentialExists(
        credentialId,
      )) as boolean;

      if (exists) {
        throw new BadRequestException('เอกสารนี้ถูกบันทึกลง Blockchain แล้ว');
      }

      /**
       * สร้างข้อความสำหรับให้ Issuer Wallet เซ็น
       */
      const signatureMessage = [
        'EduChain Credential',
        `Credential ID: ${credentialId}`,
        `Document Hash: ${documentHash}`,
        `Holder Address: ${holderAddress}`,
      ].join('\n');

      const issuerSignature = await this.wallet.signMessage(signatureMessage);

      /**
       * ส่ง Transaction ไปยัง Smart Contract
       */
      const tx = (await this.contract.registerCredential(
        credentialId,
        documentHash,
        holderAddress,
        issuerSignature,
      )) as ethers.ContractTransactionResponse;

      /**
       * รอให้ Transaction ถูกยืนยันบน Blockchain
       */
      const receipt = await tx.wait();

      if (!receipt) {
        throw new InternalServerErrorException(
          'ไม่พบข้อมูลยืนยัน Transaction จาก Blockchain',
        );
      }

      return {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        network: this.networkName,
      };
    } catch (error) {
      /**
       * แสดง error จริงใน Terminal เพื่อใช้ Debug ตอนพัฒนา
       * ห้ามส่ง private key หรือ secret ออกไปใน response
       */
      console.error('Blockchain register error:', error);

      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        'บันทึกข้อมูลเอกสารลง Blockchain ไม่สำเร็จ',
      );
    }
  }
  /**
   * ดึงข้อมูล Credential จาก Smart Contract
   */
  async getCredentialFromChain(credentialId: string): Promise<{
    credentialId: string;
    documentHash: string;
    issuerAddress: string;
    holderAddress: string;
    issuerSignature: string;
    timestamp: number;
  }> {
    if (!credentialId) {
      throw new BadRequestException('กรุณาระบุ Credential ID');
    }

    try {
      /**
       * เช็คก่อนว่ามี credential นี้บน Blockchain หรือไม่
       */
      const exists = (await this.contract.credentialExists(
        credentialId,
      )) as boolean;

      if (!exists) {
        throw new NotFoundException('ไม่พบข้อมูลเอกสารนี้บน Blockchain');
      }

      /**
       * อ่านข้อมูลจาก Smart Contract
       */
      const result = (await this.contract.getCredential(
        credentialId,
      )) as unknown[];

      const timestampRaw = result[5] as bigint;

      return {
        credentialId: result[0] as string,
        documentHash: result[1] as string,
        issuerAddress: result[2] as string,
        holderAddress: result[3] as string,
        issuerSignature: result[4] as string,
        timestamp: Number(timestampRaw),
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        'อ่านข้อมูลเอกสารจาก Blockchain ไม่สำเร็จ',
      );
    }
  }
}
