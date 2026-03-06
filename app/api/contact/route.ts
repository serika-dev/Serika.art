import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, emailTemplates } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, reason, subject, message } = body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address' },
        { status: 400 }
      );
    }

    const category = reason || 'General';

    // Send confirmation email to user
    const confirmationTemplate = emailTemplates.contactConfirmation(name, subject);
    await sendEmail({
      to: email,
      subject: confirmationTemplate.subject,
      text: confirmationTemplate.text,
      from: 'Serika <no-reply@serika.email>',
    });

    // Send notification to admin
    const notificationTemplate = emailTemplates.contactNotification(name, email, subject, message, category);
    await sendEmail({
      to: 'pikachu@serika.dev',
      subject: notificationTemplate.subject,
      text: notificationTemplate.text,
      from: 'Serika Contact <no-reply@serika.email>',
      replyTo: email,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
