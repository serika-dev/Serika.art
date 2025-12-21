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
};
