import { Module } from '@nestjs/common';
import { SupabaseStorageService } from './supabase-storage.service';

/**
 * StorageModule ใช้จัดการการอัปโหลดไฟล์เอกสารไปยัง Supabase Storage
 */
@Module({
  providers: [SupabaseStorageService],
  exports: [SupabaseStorageService],
})
export class StorageModule {}
