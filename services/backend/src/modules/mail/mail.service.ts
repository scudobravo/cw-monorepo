import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

type Product = 'DevOracle' | 'RingWise';

interface SenderConfig {
  from: string;
  name: string;
  primaryColor: string;
  websiteUrl: string;
  downloadUrl: string;
}

const SENDER: Record<Product, SenderConfig> = {
  DevOracle: {
    from: 'noreply@devoracle.com',
    name: 'DevOracle',
    primaryColor: '#6366f1',
    websiteUrl: 'https://devoracle.com',
    downloadUrl: 'https://devoracle.com/download',
  },
  RingWise: {
    from: 'noreply@ringwise.uk',
    name: 'RingWise',
    primaryColor: '#10b981',
    websiteUrl: 'https://ringwise.uk',
    downloadUrl: 'https://ringwise.uk/download',
  },
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('resend.apiKey');
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY not set — emails will be skipped');
    }
    this.resend = new Resend(apiKey ?? '');
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  async sendWelcome(product: Product, toEmail: string): Promise<void> {
    const s = SENDER[product];
    await this.send({
      product,
      to: toEmail,
      subject: `Welcome to ${s.name} — download your app`,
      html: this.welcomeHtml(s),
    });
  }

  async sendPaymentFailed(product: Product, toEmail: string): Promise<void> {
    const s = SENDER[product];
    await this.send({
      product,
      to: toEmail,
      subject: `${s.name} — payment failed`,
      html: this.paymentFailedHtml(s),
    });
  }

  async sendSubscriptionCancelled(
    product: Product,
    toEmail: string,
  ): Promise<void> {
    const s = SENDER[product];
    await this.send({
      product,
      to: toEmail,
      subject: `Your ${s.name} subscription has ended`,
      html: this.subscriptionCancelledHtml(s),
    });
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private async send(opts: {
    product: Product;
    to: string;
    subject: string;
    html: string;
  }): Promise<void> {
    if (!this.config.get<string>('resend.apiKey')) {
      this.logger.warn(`[${opts.product}] Skipping email to ${opts.to} — no API key`);
      return;
    }
    try {
      const { error } = await this.resend.emails.send({
        from: `${SENDER[opts.product].name} <${SENDER[opts.product].from}>`,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
      });
      if (error) {
        this.logger.error(`[${opts.product}] Resend error for ${opts.to}: ${error.message}`);
      } else {
        this.logger.log(`[${opts.product}] Email sent to ${opts.to}: ${opts.subject}`);
      }
    } catch (err) {
      this.logger.error(`[${opts.product}] Failed to send email to ${opts.to}`, err);
    }
  }

  // ─── HTML Templates ────────────────────────────────────────────────────────

  private baseHtml(s: SenderConfig, content: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:${s.primaryColor};padding:32px 40px;text-align:center;">
              <span style="color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">${s.name}</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #f3f4f6;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                &copy; ${new Date().getFullYear()} ${s.name} &bull;
                <a href="${s.websiteUrl}" style="color:#9ca3af;">${s.websiteUrl.replace('https://', '')}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private welcomeHtml(s: SenderConfig): string {
    return this.baseHtml(
      s,
      `<h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;">
        Your account is ready 🎉
      </h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">
        Welcome to <strong>${s.name}</strong>! Your subscription is active.
        Download the app and sign in with this email address to get started.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${s.downloadUrl}"
           style="display:inline-block;background:${s.primaryColor};color:#ffffff;font-size:15px;font-weight:600;
                  padding:14px 32px;border-radius:8px;text-decoration:none;">
          Download ${s.name}
        </a>
      </div>
      <p style="margin:0;font-size:13px;color:#6b7280;">
        If you didn't purchase ${s.name}, you can safely ignore this email.
      </p>`,
    );
  }

  private paymentFailedHtml(s: SenderConfig): string {
    return this.baseHtml(
      s,
      `<h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;">
        Payment failed
      </h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">
        We couldn't process your payment for <strong>${s.name}</strong>.
        Your access may be interrupted until the payment is resolved.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${s.websiteUrl}/pricing"
           style="display:inline-block;background:${s.primaryColor};color:#ffffff;font-size:15px;font-weight:600;
                  padding:14px 32px;border-radius:8px;text-decoration:none;">
          Update payment method
        </a>
      </div>
      <p style="margin:0;font-size:13px;color:#6b7280;">
        If you have questions, reply to this email and we'll help you out.
      </p>`,
    );
  }

  private subscriptionCancelledHtml(s: SenderConfig): string {
    return this.baseHtml(
      s,
      `<h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;">
        Subscription ended
      </h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">
        Your <strong>${s.name}</strong> subscription has been cancelled.
        You can reactivate at any time from our website.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${s.websiteUrl}/pricing"
           style="display:inline-block;background:${s.primaryColor};color:#ffffff;font-size:15px;font-weight:600;
                  padding:14px 32px;border-radius:8px;text-decoration:none;">
          Reactivate ${s.name}
        </a>
      </div>
      <p style="margin:0;font-size:13px;color:#6b7280;">
        Thanks for trying ${s.name}. We'd love to have you back.
      </p>`,
    );
  }
}
