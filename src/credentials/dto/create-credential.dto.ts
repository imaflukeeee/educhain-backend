/* eslint-disable @typescript-eslint/no-unsafe-call */

import { IsDateString, IsEmail, IsOptional, IsString } from 'class-validator';

/**
 * DTO สำหรับรับข้อมูล Metadata ของเอกสารจาก Issuer
 * ส่วนไฟล์ PDF จะรับผ่าน multipart/form-data แยกต่างหาก
 */
export class CreateCredentialDto {
  /**
   * Email ของ Holder ที่เป็นเจ้าของเอกสาร
   * ระบบจะใช้ email นี้หา user role HOLDER ใน Database
   */
  @IsEmail()
  holderEmail!: string;

  /**
   * ชื่อนักศึกษา / ผู้ถือเอกสาร
   */
  @IsString()
  studentName!: string;

  /**
   * รหัสนักศึกษา
   */
  @IsString()
  studentId!: string;

  /**
   * คณะ
   */
  @IsOptional()
  @IsString()
  faculty?: string;

  /**
   * สาขา
   */
  @IsOptional()
  @IsString()
  major?: string;

  /**
   * ชื่อเอกสาร เช่น Degree Certificate หรือ Transcript
   */
  @IsString()
  documentTitle!: string;

  /**
   * วันที่ออกเอกสาร
   * ตัวอย่าง: 2026-05-12
   */
  @IsDateString()
  issuedAt!: string;

  /**
   * รหัสคำร้องเอกสารที่เป็นต้นทางของการออกเอกสาร
   */
  @IsOptional()
  @IsString()
  requestId?: string;
}
