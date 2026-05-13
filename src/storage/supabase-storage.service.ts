import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Service สำหรับจัดการไฟล์บน Supabase Storage
 * ใช้เฉพาะฝั่ง Backend เท่านั้น
 */
@Injectable()
export class SupabaseStorageService {
  private readonly supabase: SupabaseClient;
  private readonly bucketName: string;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucketName = process.env.SUPABASE_STORAGE_BUCKET;

    if (!supabaseUrl || !serviceRoleKey || !bucketName) {
      throw new InternalServerErrorException(
        'ตั้งค่า Supabase Storage ไม่ครบถ้วน',
      );
    }

    this.supabase = createClient(supabaseUrl, serviceRoleKey);
    this.bucketName = bucketName;
  }

  /**
   * อัปโหลดไฟล์ PDF ไปยัง Supabase Storage
   */
  async uploadPdf(params: {
    fileBuffer: Buffer;
    storagePath: string;
    mimeType: string;
  }): Promise<string> {
    const { error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(params.storagePath, params.fileBuffer, {
        contentType: params.mimeType,
        upsert: false,
      });

    if (error) {
      throw new InternalServerErrorException(
        `อัปโหลดไฟล์ไปยัง Supabase ไม่สำเร็จ: ${error.message}`,
      );
    }

    return params.storagePath;
  }

  /**
   * สร้าง Signed URL สำหรับเปิดหรือดาวน์โหลดไฟล์จาก Private Bucket
   * URL นี้มีอายุจำกัด ไม่เปิดไฟล์เป็น Public ถาวร
   */
  async createSignedUrl(params: {
    storagePath: string;
    expiresInSeconds?: number;
  }): Promise<string> {
    const { storagePath, expiresInSeconds = 60 * 5 } = params;

    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw new InternalServerErrorException(
        `สร้างลิงก์ดาวน์โหลดไฟล์ไม่สำเร็จ: ${error?.message ?? 'ไม่ทราบสาเหตุ'}`,
      );
    }

    return data.signedUrl;
  }
}
