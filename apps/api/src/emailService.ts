/**
 * Transactional Email Dispatcher & Template Engine
 *
 * Tier-1 Production Email Abstraction:
 * - Zero-cost development & testing transport (in-memory + structured logging)
 * - Pluggable transport for SMTP / Resend / AWS SES in production
 * - Generates high-contrast, accessible HTML + RFC-compliant Plain Text fallbacks
 * - Embedded anti-phishing warnings and TTL expiry notices
 */

import { createTransport, type Transporter, type SendMailOptions } from 'nodemailer'

export interface TransactionalEmail {
  to: string
  subject: string
  html: string
  text: string
  metadata?: Record<string, unknown>
}

export interface EmailTransport {
  send(email: TransactionalEmail): Promise<{ id: string; success: boolean }>
}

class DevTransport implements EmailTransport {
  private inMemoryOutbox: TransactionalEmail[] = []

  async send(email: TransactionalEmail): Promise<{ id: string; success: boolean }> {
    const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    this.inMemoryOutbox.push(email)
    if (this.inMemoryOutbox.length > 100) {
      this.inMemoryOutbox.shift()
    }

    console.log(`\n[Transactional Email Dispatch]`)
    console.log(`To: ${email.to}`)
    console.log(`Subject: ${email.subject}`)
    console.log(`Metadata:`, email.metadata || {})
    console.log(`───────────────────────────────────────────\n`)

    return { id, success: true }
  }

  getOutbox(): TransactionalEmail[] {
    return [...this.inMemoryOutbox]
  }

  clearOutbox(): void {
    this.inMemoryOutbox = []
  }
}

class SmtpTransport implements EmailTransport {
  private transporter: Transporter

  constructor(private config: {
    host: string
    port: number
    secure: boolean
    auth: { user: string; pass: string }
    from: string
  }) {
    this.transporter = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    })
  }

  async send(email: TransactionalEmail): Promise<{ id: string; success: boolean }> {
    const mailOptions: SendMailOptions = {
      from: this.config.from,
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    }

    const info = await this.transporter.sendMail(mailOptions)
    return { id: info.messageId || `msg_${Date.now()}`, success: true }
  }

  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify()
      return true
    } catch {
      return false
    }
  }
}

class EmailService {
  private transport: EmailTransport
  private devTransport: DevTransport

  constructor(config?: {
    host?: string
    port?: number
    secure?: boolean
    authUser?: string
    authPass?: string
    from?: string
    nodeEnv?: string
  }) {
    this.devTransport = new DevTransport()

    const isProduction = config?.nodeEnv === 'production'
    const hasSmtpConfig = config?.host && config?.authUser && config?.authPass

    if (isProduction && hasSmtpConfig) {
      this.transport = new SmtpTransport({
        host: config.host!,
        port: config.port ?? 587,
        secure: config.secure ?? false,
        auth: { user: config.authUser!, pass: config.authPass! },
        from: config.from ?? `Nvara Operations <noreply@${config.host!}>`,
      })
    } else if (isProduction && !hasSmtpConfig) {
      throw new Error('Production environment requires SMTP configuration (EMAIL_HOST, EMAIL_USER, EMAIL_PASS)')
    } else {
      this.transport = this.devTransport
    }
  }

  async sendEmail(email: TransactionalEmail): Promise<{ id: string; success: boolean }> {
    return this.transport.send(email)
  }

  getOutbox(): TransactionalEmail[] {
    return this.devTransport.getOutbox()
  }

  clearOutbox(): void {
    this.devTransport.clearOutbox()
  }

  buildInvitationEmail(params: {
    to: string
    displayName: string
    organizationName: string
    inviterName: string
    roleName: string
    inviteUrl: string
    expiresInDays?: number
  }): TransactionalEmail {
    const {
      to,
      displayName,
      organizationName,
      inviterName,
      roleName,
      inviteUrl,
      expiresInDays = 7,
    } = params

    const subject = `Invitation to join ${organizationName} Operations Workspace`

    const text = `
Hello ${displayName},

${inviterName} has invited you to join ${organizationName} as a ${roleName}.

Set up your account using this link (valid for ${expiresInDays} days):
${inviteUrl}

If you did not expect this invitation, please ignore this email.
`.trim()

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin:0; padding:0; background-color:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#0f172a; }
    .container { max-width:560px; margin:40px auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; overflow:hidden; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background:#0b131b; padding:32px; text-align:center; color:#ffffff; }
    .content { padding:32px; font-size:14.5px; line-height:1.6; color:#334155; }
    .btn { display:inline-block; padding:13px 28px; background-color:#059669; color:#ffffff; font-weight:600; font-size:14px; text-decoration:none; border-radius:10px; margin:24px 0; }
    .footer { padding:24px 32px; background-color:#f1f5f9; font-size:12px; color:#64748b; border-top:1px solid #e2e8f0; text-align:center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin:0;font-size:20px;letter-spacing:-0.02em;">${organizationName}</h1>
      <p style="margin:6px 0 0;font-size:13px;color:#94a3b8;">Operations & Escalation Management</p>
    </div>
    <div class="content">
      <h2 style="font-size:18px;color:#0f172a;margin-top:0;">Workspace Invitation</h2>
      <p>Hello <strong>${displayName}</strong>,</p>
      <p><strong>${inviterName}</strong> has invited you to join the <strong>${organizationName} Operations Workspace</strong> as a <strong>${roleName}</strong>.</p>
      
      <div style="text-align:center;">
        <a href="${inviteUrl}" class="btn" style="color:#ffffff;">Accept Invitation & Set Password</a>
      </div>

      <p style="font-size:13px;color:#64748b;margin-top:20px;">
        Direct Link:<br>
        <code style="word-break:break-all;background:#f1f5f9;padding:4px 8px;border-radius:6px;font-size:12px;">${inviteUrl}</code>
      </p>

      <p style="font-size:12px;color:#94a3b8;margin-top:28px;">
        This one-time link is valid for ${expiresInDays} days and can only be used once.
      </p>
    </div>
    <div class="footer">
      Enterprise Zero-Trust Protocol · Automated Security Dispatch<br>
      If you did not expect this invitation, please ignore this email.
    </div>
  </div>
</body>
</html>
`.trim()

    return {
      to,
      subject,
      text,
      html,
      metadata: { type: 'TEAM_INVITATION', organizationName, roleName },
    }
  }

  buildPasswordResetEmail(params: {
    to: string
    displayName: string
    resetUrl: string
    ipAddress?: string
    ttlMinutes?: number
  }): TransactionalEmail {
    const { to, displayName, resetUrl, ipAddress = 'Unknown', ttlMinutes = 15 } = params

    const subject = `Password reset instructions for your Nvara account`

    const text = `
Hello ${displayName},

We received a request to reset the password for your Nvara Operations account associated with ${to}.

To set a new password, please use the following link (valid for ${ttlMinutes} minutes):
${resetUrl}

Request details:
- Initiated from IP: ${ipAddress}
- Timestamp: ${new Date().toUTCString()}

If you did not request a password reset, you can safely ignore this email. Your existing password remains secure.
`.trim()

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin:0; padding:0; background-color:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#0f172a; }
    .container { max-width:560px; margin:40px auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; overflow:hidden; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background:#0b131b; padding:32px; text-align:center; color:#ffffff; }
    .content { padding:32px; font-size:14.5px; line-height:1.6; color:#334155; }
    .btn { display:inline-block; padding:13px 28px; background-color:#059669; color:#ffffff; font-weight:600; font-size:14px; text-decoration:none; border-radius:10px; margin:24px 0; }
    .footer { padding:24px 32px; background-color:#f1f5f9; font-size:12px; color:#64748b; border-top:1px solid #e2e8f0; text-align:center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin:0;font-size:20px;letter-spacing:-0.02em;">Nvara Security</h1>
      <p style="margin:6px 0 0;font-size:13px;color:#94a3b8;">Authentication & Account Protection</p>
    </div>
    <div class="content">
      <h2 style="font-size:18px;color:#0f172a;margin-top:0;">Reset Your Password</h2>
      <p>Hello <strong>${displayName}</strong>,</p>
      <p>A password reset was requested for your operations account (<code>${to}</code>).</p>
      
      <div style="text-align:center;">
        <a href="${resetUrl}" class="btn" style="color:#ffffff;">Set New Password →</a>
      </div>

      <p style="font-size:13px;color:#64748b;margin-top:20px;">
        Direct Link:<br>
        <code style="word-break:break-all;background:#f1f5f9;padding:4px 8px;border-radius:6px;font-size:12px;">${resetUrl}</code>
      </p>

      <div style="background:#fffbeb;border:1px solid #fef3c7;border-radius:10px;padding:14px;margin-top:24px;font-size:12.5px;color:#92400e;">
        <strong>Security Context:</strong><br>
        • Request IP: <code>${ipAddress}</code><br>
        • Expiry: <strong>${ttlMinutes} minutes</strong> (Single-use token)
      </div>
    </div>
    <div class="footer">
      If you did not request this change, please ignore this email or notify your Project Manager immediately.
    </div>
  </div>
</body>
</html>
`.trim()

    return {
      to,
      subject,
      text,
      html,
      metadata: { type: 'PASSWORD_RESET', ipAddress },
    }
  }
}

function loadEmailConfig() {
  return {
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : undefined,
    secure: process.env.EMAIL_SECURE === 'true',
    authUser: process.env.EMAIL_USER,
    authPass: process.env.EMAIL_PASS,
    from: process.env.EMAIL_FROM,
    nodeEnv: process.env.NODE_ENV,
  }
}

export const emailService = new EmailService(loadEmailConfig())