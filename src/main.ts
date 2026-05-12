import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  /**
   * เปิด CORS เพื่อให้ Frontend เรียก Backend ได้
   * ตอน Local: http://localhost:3000
   * ตอน Deploy จริง: เปลี่ยนเป็น URL ของ Vercel
   */
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  });

  /**
   * ValidationPipe ใช้ตรวจสอบ DTO อัตโนมัติ
   * เช่น email ต้องเป็น email, password ต้องยาวพอ, role ต้องถูกต้อง
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // ตัด field ที่ไม่อยู่ใน DTO ทิ้ง
      forbidNonWhitelisted: true, // ถ้าส่ง field แปลก ๆ มา ให้ error ทันที
      transform: true, // แปลง type ข้อมูลให้ตรงกับ DTO
    }),
  );

  /**
   * Railway จะกำหนด PORT ให้เองตอน Deploy
   * แต่ตอน Local เราใช้ 4000
   */
  const port = process.env.PORT || 4000;

  await app.listen(port);

  console.log(`EduChain backend running on port ${port}`);
}

void bootstrap();
