'use server'

import { createClient } from '@/utils/supabase/server'
import { getTransporter } from '@/lib/mail'
import { stripe } from '@/lib/stripe'

const GENERAL_RESERVATION_FEE = 50 // $50 USD

interface GeneralReservationInput {
    full_name: string
    email: string
    phone: string
    guests: number
    date: string
    time: string
    special_requests?: string
    tableId?: string
    tableName?: string
}

function generateBookingRef() {
    return 'RST-' + Math.random().toString(36).substr(2, 6).toUpperCase()
}

// ─── STEP 1: Create Stripe PaymentIntent ($50) ───────────────────────────────
export async function createGeneralReservationIntent({
    full_name,
    email,
    phone,
    guests,
    date,
    time,
    special_requests,
    tableId,
    tableName,
}: GeneralReservationInput): Promise<{ success: boolean; clientSecret?: string; error?: string }> {
    if (!full_name || !email || !phone || !guests || !date || !time) {
        return { success: false, error: 'All required fields must be filled.' }
    }

    const selectedDate = new Date(date + 'T12:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (selectedDate < today) {
        return { success: false, error: 'Please select a future date.' }
    }

    if (!process.env.STRIPE_SECRET_KEY) {
        return { success: false, error: 'Payment system is not configured. Please contact us directly.' }
    }

    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: GENERAL_RESERVATION_FEE * 100,
            currency: 'usd',
            metadata: {
                type: 'general_reservation',
                full_name,
                email,
                phone,
                guests: guests.toString(),
                date,
                time,
                special_requests: special_requests || '',
                tableId: tableId || '',
                tableName: tableName || '',
            },
            automatic_payment_methods: { enabled: true },
        })

        return { success: true, clientSecret: paymentIntent.client_secret! }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('Stripe PaymentIntent error:', err)
        return { success: false, error: 'Could not initialize payment: ' + message }
    }
}

// ─── STEP 2: Verify payment, insert reservation, send emails ─────────────────
export async function finalizeGeneralReservation(paymentIntentId: string): Promise<{
    success: boolean
    bookingRef?: string
    details?: { full_name: string; email: string; date: string; time: string; guests: number }
    error?: string
}> {
    if (!process.env.STRIPE_SECRET_KEY) {
        return { success: false, error: 'Payment system is not configured.' }
    }

    try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

        if (paymentIntent.status !== 'succeeded') {
            return { success: false, error: 'Payment was not successful. Please try again.' }
        }

        const meta = paymentIntent.metadata
        const full_name = meta.full_name
        const email = meta.email
        const phone = meta.phone
        const guests = parseInt(meta.guests || '1')
        const date = meta.date
        const time = meta.time
        const special_requests = meta.special_requests || ''
        const tableId = meta.tableId || null
        const tableName = meta.tableName || null

        if (!full_name || !email || !date || !time) {
            return { success: false, error: 'Reservation details are incomplete.' }
        }

        // Idempotency: check if already recorded
        const supabase = await createClient()
        const { data: existing } = await supabase
            .from('reservations')
            .select('id, special_requests')
            .ilike('special_requests', `%${paymentIntentId}%`)
            .maybeSingle()

        let bookingRef: string

        if (existing) {
            const refMatch = existing.special_requests?.match(/Booking Ref: (RST-\w+)/)
            bookingRef = refMatch?.[1] || generateBookingRef()
        } else {
            bookingRef = generateBookingRef()

            const { error: insertError } = await supabase.from('reservations').insert({
                full_name,
                email,
                phone,
                guests: guests.toString(),
                date,
                time,
                table_id: tableId,
                status: 'confirmed',
                special_requests: [
                    `Booking Ref: ${bookingRef}`,
                    tableName ? `Table: ${tableName}` : null,
                    `$${GENERAL_RESERVATION_FEE} paid via Stripe (${paymentIntentId})`,
                    special_requests,
                ]
                    .filter(Boolean)
                    .join(' | '),
            })

            if (insertError) {
                // Log but don't block — payment already succeeded, customer should see confirmation
                console.error('Reservation insert error (non-fatal):', insertError.message)
            }

            // Always send emails regardless of DB insert result
            // Wrapped in try/catch so email failures never crash the reservation flow
            try {
                await sendGuestConfirmationEmail({ to: email, full_name, guests, date, time, bookingRef, special_requests })
            } catch (emailErr) {
                console.error('Guest confirmation email failed (non-fatal):', emailErr)
            }
            try {
                await sendAdminNotificationEmail({ full_name, email, phone, guests, date, time, bookingRef, special_requests, paymentIntentId })
            } catch (emailErr) {
                console.error('Admin notification email failed (non-fatal):', emailErr)
            }
        }

        return { success: true, bookingRef, details: { full_name, email, date, time, guests } }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('finalizeGeneralReservation error:', err)
        return { success: false, error: message }
    }
}

// ─── Email: Guest Confirmation ────────────────────────────────────────────────
async function sendGuestConfirmationEmail({
    to,
    full_name,
    guests,
    date,
    time,
    bookingRef,
    special_requests,
}: {
    to: string
    full_name: string
    guests: number
    date: string
    time: string
    bookingRef: string
    special_requests?: string
}) {
    const transporter = getTransporter()
    if (!transporter) return

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://resethtx.com'
    const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })

    const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Reservation Confirmed — Reset HTX</title></head>
<body style="margin:0;padding:0;background:#000;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#000;padding:40px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

  <!-- Logo -->
  <tr><td align="center" style="padding-bottom:28px;">
    <img src="${baseUrl}/logos/logo-main.png" alt="Reset HTX" style="max-width:200px;height:auto;" />
  </td></tr>

  <!-- Gold Header -->
  <tr><td style="background:linear-gradient(135deg,#D4AF37 0%,#F0DEAA 100%);border-radius:12px 12px 0 0;padding:32px;text-align:center;">
    <div style="width:52px;height:52px;background:rgba(0,0,0,0.18);border-radius:50%;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;font-size:26px;line-height:52px;">✓</div>
    <h1 style="margin:0;color:#000;font-size:20px;font-weight:800;letter-spacing:3px;text-transform:uppercase;">Reservation Confirmed</h1>
    <p style="margin:8px 0 0;color:rgba(0,0,0,0.6);font-size:13px;letter-spacing:1px;">Your table is secured at Reset HTX</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:#111;border:1px solid #222;border-top:none;border-radius:0 0 12px 12px;padding:32px;">

    <!-- Booking Ref Badge -->
    <div style="background:#000;border:1px solid #D4AF37;border-radius:8px;padding:18px;text-align:center;margin-bottom:28px;">
      <p style="margin:0 0 4px;color:#666;font-size:10px;text-transform:uppercase;letter-spacing:2px;">Booking Reference</p>
      <p style="margin:0;color:#D4AF37;font-size:28px;font-weight:800;letter-spacing:4px;">${bookingRef}</p>
    </div>

    <!-- Details Table -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:11px 0;border-bottom:1px solid #222;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:1px;width:38%;">Guest</td>
        <td style="padding:11px 0;border-bottom:1px solid #222;color:#fff;font-size:14px;font-weight:600;">${full_name}</td>
      </tr>
      <tr>
        <td style="padding:11px 0;border-bottom:1px solid #222;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Date</td>
        <td style="padding:11px 0;border-bottom:1px solid #222;color:#fff;font-size:14px;font-weight:600;">${formattedDate}</td>
      </tr>
      <tr>
        <td style="padding:11px 0;border-bottom:1px solid #222;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Time</td>
        <td style="padding:11px 0;border-bottom:1px solid #222;color:#fff;font-size:14px;font-weight:600;">${time}</td>
      </tr>
      <tr>
        <td style="padding:11px 0;border-bottom:1px solid #222;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Party Size</td>
        <td style="padding:11px 0;border-bottom:1px solid #222;color:#fff;font-size:14px;font-weight:600;">${guests} ${guests === 1 ? 'guest' : 'guests'}</td>
      </tr>
      <tr>
        <td style="padding:11px 0;${special_requests ? 'border-bottom:1px solid #222;' : ''}color:#666;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Reservation Fee</td>
        <td style="padding:11px 0;${special_requests ? 'border-bottom:1px solid #222;' : ''}color:#4CAF50;font-size:14px;font-weight:700;">$50.00 — Paid ✓</td>
      </tr>
      ${special_requests ? `
      <tr>
        <td style="padding:11px 0;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:1px;vertical-align:top;">Requests</td>
        <td style="padding:11px 0;color:#bbb;font-size:14px;">${special_requests}</td>
      </tr>` : ''}
    </table>

    <!-- Notice -->
    <div style="background:#1a1a1a;border-left:3px solid #D4AF37;border-radius:4px;padding:16px;margin-top:24px;">
      <p style="margin:0;color:#bbb;font-size:13px;line-height:1.7;">
        Please <strong style="color:#fff;">present this email upon arrival</strong>. Your $50 reservation fee confirms your table — see you soon! 🥂
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:28px;padding-top:24px;border-top:1px solid #1e1e1e;">
      <img src="${baseUrl}/logos/r_logo.png" alt="R" style="max-width:32px;height:auto;opacity:0.6;margin-bottom:10px;" />
      <p style="margin:0;color:#444;font-size:12px;">21+ to enter &nbsp;·&nbsp; Reset HTX &nbsp;·&nbsp; Houston, TX</p>
      <p style="margin:5px 0 0;color:#333;font-size:11px;">Questions? Reply to this email or visit resethtx.com</p>
    </div>

  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

    try {
        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"Reset HTX" <sales@resethtx.com>',
            to,
            subject: `Reservation Confirmed — ${formattedDate} · Reset HTX`,
            html,
        })
    } catch (err) {
        console.error('Guest confirmation email error (non-fatal):', err)
    }
}

// ─── Email: Admin Notification ────────────────────────────────────────────────
async function sendAdminNotificationEmail({
    full_name,
    email,
    phone,
    guests,
    date,
    time,
    bookingRef,
    special_requests,
    paymentIntentId,
}: {
    full_name: string
    email: string
    phone: string
    guests: number
    date: string
    time: string
    bookingRef: string
    special_requests?: string
    paymentIntentId: string
}) {
    const transporter = getTransporter()
    if (!transporter) return

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://resethtx.com'
    const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })

    const html = `
<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:20px;background:#f4f4f4;font-family:Arial,sans-serif;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <div style="background:#000;padding:18px 24px;">
    <p style="margin:0;color:#D4AF37;font-size:10px;text-transform:uppercase;letter-spacing:2px;font-weight:700;">Reset HTX · Admin</p>
    <h2 style="margin:4px 0 0;color:#fff;font-size:17px;">🍽️ New General Table Booking</h2>
  </div>
  <div style="padding:24px;">
    <table width="100%" style="border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:9px 0;border-bottom:1px solid #eee;color:#888;width:38%;">Booking Ref</td><td style="padding:9px 0;border-bottom:1px solid #eee;font-weight:700;color:#B8860B;">${bookingRef}</td></tr>
      <tr><td style="padding:9px 0;border-bottom:1px solid #eee;color:#888;">Guest Name</td><td style="padding:9px 0;border-bottom:1px solid #eee;font-weight:600;">${full_name}</td></tr>
      <tr><td style="padding:9px 0;border-bottom:1px solid #eee;color:#888;">Email</td><td style="padding:9px 0;border-bottom:1px solid #eee;"><a href="mailto:${email}" style="color:#1a73e8;text-decoration:none;">${email}</a></td></tr>
      <tr><td style="padding:9px 0;border-bottom:1px solid #eee;color:#888;">Phone</td><td style="padding:9px 0;border-bottom:1px solid #eee;">${phone}</td></tr>
      <tr><td style="padding:9px 0;border-bottom:1px solid #eee;color:#888;">Date</td><td style="padding:9px 0;border-bottom:1px solid #eee;font-weight:600;">${formattedDate}</td></tr>
      <tr><td style="padding:9px 0;border-bottom:1px solid #eee;color:#888;">Time</td><td style="padding:9px 0;border-bottom:1px solid #eee;">${time}</td></tr>
      <tr><td style="padding:9px 0;border-bottom:1px solid #eee;color:#888;">Party Size</td><td style="padding:9px 0;border-bottom:1px solid #eee;">${guests} ${guests === 1 ? 'guest' : 'guests'}</td></tr>
      <tr><td style="padding:9px 0;border-bottom:1px solid #eee;color:#888;">Amount Paid</td><td style="padding:9px 0;border-bottom:1px solid #eee;color:green;font-weight:700;">$50.00 ✓ Stripe</td></tr>
      ${special_requests ? `<tr><td style="padding:9px 0;border-bottom:1px solid #eee;color:#888;vertical-align:top;">Requests</td><td style="padding:9px 0;border-bottom:1px solid #eee;color:#555;">${special_requests}</td></tr>` : ''}
      <tr><td style="padding:9px 0;color:#888;font-size:12px;">Stripe PI</td><td style="padding:9px 0;font-size:11px;font-family:monospace;color:#666;">${paymentIntentId}</td></tr>
    </table>
    <div style="margin-top:20px;text-align:center;">
      <a href="${baseUrl}/admin/reservations" style="background:#000;color:#D4AF37;padding:12px 26px;text-decoration:none;border-radius:6px;font-weight:700;font-size:13px;display:inline-block;">View in Admin Dashboard →</a>
    </div>
  </div>
</div>
</body>
</html>`

    try {
        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"Reset HTX System" <sales@resethtx.com>',
            to: process.env.ADMIN_EMAIL || process.env.SMTP_USER || 'sales@resethtx.com',
            subject: `🍽️ New Reservation — ${full_name} · ${formattedDate} @ ${time}`,
            html,
        })
    } catch (err) {
        console.error('Admin notification email error (non-fatal):', err)
    }
}

// ─── Utility: Check if a date has an event ───────────────────────────────────
export async function getEventByDate(date: string): Promise<{ hasEvent: boolean; eventTitle?: string; eventId?: string }> {
    const supabase = await createClient()

    try {
        const startOfDay = new Date(date + 'T00:00:00').toISOString()
        const endOfDay = new Date(date + 'T23:59:59').toISOString()

        const { data } = await supabase
            .from('events')
            .select('id, title')
            .gte('date', startOfDay)
            .lte('date', endOfDay)
            .limit(1)

        if (data && data.length > 0) {
            return { hasEvent: true, eventTitle: data[0].title, eventId: data[0].id }
        }

        return { hasEvent: false }
    } catch {
        return { hasEvent: false }
    }
}
