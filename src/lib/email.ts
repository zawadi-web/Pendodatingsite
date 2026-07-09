import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD, // Google App Password (NOT your Gmail password)
  },
});

export async function sendPasswordResetEmail(to: string, resetLink: string, userName?: string) {
  const mailOptions = {
    from: `"Pendo Dating" <${process.env.GMAIL_USER}>`,
    to,
    subject: '🔐 Reset your Pendo password',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Reset Your Pendo Password</title>
</head>
<body style="margin:0;padding:0;background:#0d0d12;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d12;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#161622;border-radius:20px;border:1px solid rgba(255,255,255,0.07);overflow:hidden;">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#ff3366,#c026d3);padding:36px;text-align:center;">
              <div style="width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;">
                <span style="font-size:28px;">❤️</span>
              </div>
              <h1 style="color:#fff;margin:0;font-size:24px;font-weight:800;letter-spacing:-0.5px;">Reset Your Password</h1>
              <p style="color:rgba(255,255,255,0.75);margin:8px 0 0;font-size:14px;">We got your request — let's get you back in!</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 36px;">
              <p style="color:#e0e0e0;font-size:16px;margin:0 0 12px;">Hey ${userName || 'there'} 👋</p>
              <p style="color:#a0a0b0;font-size:14px;line-height:1.7;margin:0 0 28px;">
                Someone requested a password reset for your Pendo account. If that was you, click the button below to set a new password. This link expires in <strong style="color:#fff;">1 hour</strong>.
              </p>

              <!-- CTA Button -->
              <div style="text-align:center;margin:32px 0;">
                <a href="${resetLink}" style="display:inline-block;background:linear-gradient(135deg,#ff3366,#c026d3);color:#fff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 40px;border-radius:50px;letter-spacing:0.3px;">
                  Reset My Password
                </a>
              </div>

              <p style="color:#606070;font-size:12px;line-height:1.7;margin:24px 0 0;border-top:1px solid rgba(255,255,255,0.06);padding-top:20px;">
                If you didn't request this, you can safely ignore this email — your account is still secure. The link will expire automatically after 1 hour.<br><br>
                Or copy this link into your browser:<br>
                <a href="${resetLink}" style="color:#ff3366;word-break:break-all;">${resetLink}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0d0d12;padding:20px 36px;text-align:center;">
              <p style="color:#404050;font-size:12px;margin:0;">© 2025 Pendo Dating · Making connections that matter ❤️</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  };

  await transporter.sendMail(mailOptions);
}
