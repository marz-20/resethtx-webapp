'use server'

import { createClient as createServerClient } from '@/utils/supabase/server' // used in updateMessageRemark
import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { getTransporter } from '@/lib/mail'

// Use service role key to bypass RLS on contact_messages table
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, serviceKey)
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.SMTP_USER || 'resethtx@gmail.com'

export async function submitContactForm(formData: FormData) {
  const supabase = getSupabaseAdmin()

  const data = {
    first_name: formData.get('firstName') as string,
    last_name: formData.get('lastName') as string,
    email: formData.get('email') as string,
    phone: formData.get('phone') as string,
    dob: formData.get('dob') as string,
    inquiry_type: formData.get('inquiryType') as string,
    message: formData.get('message') as string,
  }

  if (!data.first_name || !data.email || !data.message || !data.phone || !data.dob) {
    return { success: false, error: 'Please fill in all required fields.' }
  }

  try {
    // 1. Save to Supabase (best-effort — don't block emails if this fails due to RLS)
    const { error: dbError } = await supabase.from('contact_messages').insert(data)
    if (dbError) {
      console.error('DB insert error (non-fatal):', dbError.message)
    } else {
      revalidatePath('/admin/inbox')
    }

    // 2. Send admin notification email
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://resethtx.com'
    const adminHtml = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:20px;background:#f4f4f4;font-family:Arial,sans-serif;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <div style="background:#000;padding:18px 24px;">
    <p style="margin:0;color:#D4AF37;font-size:10px;text-transform:uppercase;letter-spacing:2px;font-weight:700;">Reset HTX · Admin</p>
    <h2 style="margin:4px 0 0;color:#fff;font-size:17px;">📬 New Contact Form Submission</h2>
  </div>
  <div style="padding:24px;">
    <table width="100%" style="border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:9px 0;border-bottom:1px solid #eee;color:#888;width:38%;">Name</td><td style="padding:9px 0;border-bottom:1px solid #eee;font-weight:600;">${data.first_name} ${data.last_name}</td></tr>
      <tr><td style="padding:9px 0;border-bottom:1px solid #eee;color:#888;">Email</td><td style="padding:9px 0;border-bottom:1px solid #eee;"><a href="mailto:${data.email}" style="color:#1a73e8;">${data.email}</a></td></tr>
      <tr><td style="padding:9px 0;border-bottom:1px solid #eee;color:#888;">Phone</td><td style="padding:9px 0;border-bottom:1px solid #eee;">${data.phone}</td></tr>
      <tr><td style="padding:9px 0;border-bottom:1px solid #eee;color:#888;">Date of Birth</td><td style="padding:9px 0;border-bottom:1px solid #eee;">${data.dob}</td></tr>
      <tr><td style="padding:9px 0;border-bottom:1px solid #eee;color:#888;">Inquiry Type</td><td style="padding:9px 0;border-bottom:1px solid #eee;">${data.inquiry_type || 'General'}</td></tr>
      <tr><td style="padding:9px 0;color:#888;vertical-align:top;">Message</td><td style="padding:9px 0;color:#333;">${data.message}</td></tr>
    </table>
    <div style="margin-top:20px;text-align:center;">
      <a href="${baseUrl}/admin/inbox" style="background:#000;color:#D4AF37;padding:12px 26px;text-decoration:none;border-radius:6px;font-weight:700;font-size:13px;display:inline-block;">View in Admin Inbox →</a>
    </div>
  </div>
</div>
</body>
</html>`

    // 3. Send auto-reply to customer
    const customerHtml = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#000;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#000;padding:40px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
  <tr><td style="background:linear-gradient(135deg,#D4AF37 0%,#F0DEAA 100%);border-radius:12px 12px 0 0;padding:32px;text-align:center;">
    <h1 style="margin:0;color:#000;font-size:20px;font-weight:800;letter-spacing:3px;text-transform:uppercase;">We Got Your Message!</h1>
    <p style="margin:8px 0 0;color:rgba(0,0,0,0.6);font-size:13px;">Thank you for reaching out to Reset HTX</p>
  </td></tr>
  <tr><td style="background:#111;border:1px solid #222;border-top:none;border-radius:0 0 12px 12px;padding:32px;">
    <p style="color:#ccc;font-size:15px;line-height:1.7;margin:0 0 16px;">Hi ${data.first_name},</p>
    <p style="color:#ccc;font-size:15px;line-height:1.7;margin:0 0 24px;">
      Thank you for contacting us! We've received your inquiry and will get back to you as soon as possible — typically within 24–48 hours.
    </p>
    <div style="background:#000;border-left:3px solid #D4AF37;border-radius:4px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;color:#bbb;font-size:13px;line-height:1.7;">
        <strong style="color:#fff;">Your message:</strong><br/>${data.message}
      </p>
    </div>
    <p style="color:#888;font-size:13px;line-height:1.7;margin:0 0 24px;">
      In the meantime, feel free to follow us on social media for the latest events and updates.
    </p>
    <div style="text-align:center;margin-top:28px;padding-top:24px;border-top:1px solid #1e1e1e;">
      <p style="margin:0;color:#444;font-size:12px;">Reset HTX · 606 Dennis St Ste 200, Houston, TX 77006</p>
      <p style="margin:5px 0 0;color:#333;font-size:11px;">resethtx@gmail.com · (832) 281-9991</p>
    </div>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

    const transporter = getTransporter()
    const emailPromises: Promise<void>[] = []

    if (transporter) {
      emailPromises.push(
        transporter.sendMail({
          from: process.env.SMTP_FROM || '"Reset HTX" <sales@resethtx.com>',
          to: ADMIN_EMAIL,
          subject: `📬 New Inquiry from ${data.first_name} ${data.last_name} — Reset HTX`,
          html: adminHtml,
        }).then(() => { }).catch((e: unknown) => console.error('Admin email error (non-fatal):', e))
      )

      emailPromises.push(
        transporter.sendMail({
          from: process.env.SMTP_FROM || '"Reset HTX" <sales@resethtx.com>',
          to: data.email,
          subject: `We received your message — Reset HTX`,
          html: customerHtml,
        }).then(() => { }).catch((e: unknown) => console.error('Customer email error (non-fatal):', e))
      )
    }

    await Promise.all(emailPromises)

    return { success: true }

  } catch (error: any) {
    console.error('Contact Form Error:', error)
    return { success: false, error: 'Failed to send message. Please try again.' }
  }
}

export async function updateMessageRemark(id: string, remark: string) {
  const supabase = await createServerClient()

  try {
    const { error } = await supabase
      .from('contact_messages')
      .update({ remarks: remark })
      .eq('id', id)

    if (error) throw error

    revalidatePath('/admin/inbox')
    return { success: true }
  } catch (error: any) {
    console.error('Update Remark Error:', error)
    return { success: false, error: 'Failed to update remark.' }
  }
}
