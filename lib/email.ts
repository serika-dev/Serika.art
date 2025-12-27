import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.AWS_EMAIL_ENDPOINT,
  port: parseInt(process.env.AWS_EMAIL_SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.AWS_EMAIL_SMTP_USERNAME,
    pass: process.env.AWS_EMAIL_PASS,
  },
});

interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  replyTo?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: options.from || 'Serika <no-reply@serika.email>',
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      replyTo: options.replyTo,
    });
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

// Email templates
export const emailTemplates = {
  contactConfirmation: (name: string, subject: string) => ({
    subject: `We received your message - ${subject}`,
    text: `Hi ${name},\n\nThank you for reaching out to us. We've received your message regarding "${subject}" and will get back to you as soon as possible.\n\nOur team typically responds within 24-48 hours. If your matter is urgent, please note that in your message.\n\nThis is an automated confirmation. Please do not reply to this email.\n\n— The Serika Team`,
  }),

  contactNotification: (name: string, email: string, subject: string, message: string, category: string) => ({
    subject: `[Contact] ${category}: ${subject}`,
    text: `New Contact Form Submission\n\nFrom: ${name}\nEmail: ${email}\nCategory: ${category}\nSubject: ${subject}\n\nMessage:\n${message}`,
  }),

  dmcaConfirmation: (name: string) => ({
    subject: 'DMCA Takedown Request Received - Serika',
    text: `DMCA Request Received\n\nDear ${name},\n\nWe have received your DMCA takedown request and will review it within 24-48 hours.\n\nIf your request is valid and complete, we will remove the infringing content and notify you once the action has been taken.\n\nIf we need additional information, we will contact you at this email address.\n\nFor questions about your DMCA request, please contact legal@serika.dev\n\n— The Serika Legal Team`,
  }),

  claimApproved: (username: string, artistName: string) => ({
    subject: `Your Artist Claim Has Been Approved - ${artistName}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">✅ Claim Approved!</h1>
        </div>
        <div style="background: #18181b; padding: 30px; border-radius: 0 0 16px 16px; color: #e4e4e7;">
          <p style="font-size: 16px; margin-bottom: 20px;">Hi <strong>${username}</strong>,</p>
          <p style="font-size: 16px; margin-bottom: 20px;">Great news! Your claim for <strong style="color: #10b981;">${artistName}</strong> has been <strong>approved</strong>.</p>
          <p style="font-size: 14px; margin-bottom: 20px; color: #a1a1aa;">You can now:</p>
          <ul style="font-size: 14px; color: #a1a1aa; padding-left: 20px;">
            <li>Edit your artist profile and add information</li>
            <li>Update your wiki page</li>
            <li>Add social links and commission info</li>
            <li>Customize your artist banner and avatar</li>
          </ul>
          <div style="text-align: center; margin-top: 30px;">
            <a href="https://serika.art/artist/${encodeURIComponent(artistName)}" style="background: #ec4899; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">View Your Artist Page</a>
          </div>
          <p style="font-size: 12px; color: #71717a; margin-top: 30px; text-align: center;">Thank you for being part of Serika!</p>
        </div>
      </div>
    `,
    text: `Hi ${username},\n\nGreat news! Your claim for "${artistName}" has been approved.\n\nYou can now edit your artist profile, update your wiki page, add social links, and customize your banner and avatar.\n\nView your artist page: https://serika.art/artist/${encodeURIComponent(artistName)}\n\n— The Serika Team`,
  }),

  claimRejected: (username: string, artistName: string, reason?: string) => ({
    subject: `Artist Claim Update - ${artistName}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Claim Not Approved</h1>
        </div>
        <div style="background: #18181b; padding: 30px; border-radius: 0 0 16px 16px; color: #e4e4e7;">
          <p style="font-size: 16px; margin-bottom: 20px;">Hi <strong>${username}</strong>,</p>
          <p style="font-size: 16px; margin-bottom: 20px;">Unfortunately, your claim for <strong>${artistName}</strong> was not approved.</p>
          ${reason ? `<div style="background: #27272a; padding: 15px; border-radius: 8px; margin-bottom: 20px;"><p style="font-size: 14px; color: #a1a1aa; margin: 0;"><strong>Reviewer Notes:</strong> ${reason}</p></div>` : ''}
          <p style="font-size: 14px; margin-bottom: 20px; color: #a1a1aa;">Common reasons for rejection include:</p>
          <ul style="font-size: 14px; color: #a1a1aa; padding-left: 20px;">
            <li>Insufficient proof of identity</li>
            <li>Verification method not completed correctly</li>
            <li>Artist tag doesn't match the claimed account</li>
          </ul>
          <p style="font-size: 14px; color: #a1a1aa; margin-top: 20px;">You can submit a new claim with additional verification if you believe this was an error.</p>
          <p style="font-size: 12px; color: #71717a; margin-top: 30px; text-align: center;">If you have questions, contact us at support@serika.dev</p>
        </div>
      </div>
    `,
    text: `Hi ${username},\n\nUnfortunately, your claim for "${artistName}" was not approved.${reason ? `\n\nReviewer Notes: ${reason}` : ''}\n\nCommon reasons for rejection include:\n- Insufficient proof of identity\n- Verification method not completed correctly\n- Artist tag doesn't match the claimed account\n\nYou can submit a new claim with additional verification if you believe this was an error.\n\nIf you have questions, contact us at support@serika.dev\n\n— The Serika Team`,
  }),
};
