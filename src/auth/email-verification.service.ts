import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailVerificationService {
  private readonly resend: Resend;
  private readonly fromEmail: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;

    if (!apiKey || !fromEmail) {
      if (process.env.EMAIL_DEV_RETURN_LINK === 'true') {
        this.resend = new Resend('re_dev_placeholder');
        this.fromEmail = 'EduChain <onboarding@resend.dev>';
        return;
      }

      throw new InternalServerErrorException(
        'ระบบอีเมลยังไม่ได้ตั้งค่า กรุณาติดต่อผู้ดูแลระบบ',
      );
    }

    this.resend = new Resend(apiKey);
    this.fromEmail = fromEmail;
  }

  async sendVerificationEmail(params: {
    email: string;
    displayName: string;
    verificationUrl: string;
  }) {
    if (process.env.EMAIL_DEV_RETURN_LINK === 'true') {
      console.log(
        `[EduChain] Email verification URL for ${params.email}: ${params.verificationUrl}`,
      );
      return;
    }

    const displayName = this.escapeHtml(params.displayName);
    const verificationUrl = this.escapeHtml(params.verificationUrl);

    const { error } = await this.resend.emails.send({
      from: this.fromEmail,
      to: [params.email],
      subject: 'ยืนยันอีเมลสำหรับบัญชี EduChain',
      text: `สวัสดี ${params.displayName}\n\nกรุณายืนยันอีเมลของคุณโดยเปิดลิงก์นี้:\n${params.verificationUrl}\n\nลิงก์มีอายุ 24 ชั่วโมง`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1e293b;max-width:600px;margin:0 auto">
          <h2 style="color:#2563eb">ยืนยันอีเมล EduChain</h2>
          <p>สวัสดี ${displayName}</p>
          <p>กรุณากดปุ่มด้านล่างเพื่อยืนยันอีเมลและเปิดใช้งานบัญชีของคุณ</p>
          <p style="margin:24px 0">
            <a href="${verificationUrl}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600">
              ยืนยันอีเมล
            </a>
          </p>
          <p style="font-size:13px;color:#64748b">ลิงก์นี้มีอายุ 24 ชั่วโมง</p>
          <p style="font-size:13px;color:#64748b">หากคุณไม่ได้ลงทะเบียนบัญชีนี้ สามารถละเว้นอีเมลฉบับนี้ได้</p>
        </div>
      `,
    });

    if (error) {
      throw new InternalServerErrorException(
        `ไม่สามารถส่งอีเมลยืนยันได้: ${error.message}`,
      );
    }
  }

  private escapeHtml(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
}
