import { IsEthereumAddress, IsNotEmpty, IsString } from 'class-validator';

export class UpdateWalletDto {
  @IsString({ message: 'บัญชีดิจิทัลต้องเป็นข้อความ' })
  @IsNotEmpty({ message: 'กรุณาระบุบัญชีดิจิทัล' })
  @IsEthereumAddress({ message: 'รูปแบบบัญชีดิจิทัลไม่ถูกต้อง' })
  walletAddress!: string;
}
