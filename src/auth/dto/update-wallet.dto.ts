import { IsEthereumAddress, IsNotEmpty, IsString } from 'class-validator';

export class UpdateWalletDto {
  @IsString({
    message: 'Wallet Address ต้องเป็นข้อความ',
  })
  @IsNotEmpty({
    message: 'กรุณาระบุ Wallet Address',
  })
  @IsEthereumAddress({
    message: 'Wallet Address ไม่ถูกต้อง',
  })
  walletAddress: string;
}
