import nodemailer from 'nodemailer';

export function getTransporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false }
  });
}

export const sendOrderConfirmation = async (to: string, details: any, orderId?: string) => {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('⚠️ Email not sent: Credentials missing in .env');
    return;
  }
  const { eventName, date, ticketType, quantity, totalAmount, name, tableSelection, bookingRef } = details;

  const typeDisplay = ticketType === 'table_reservation' ? `Table Reservation: ${tableSelection || 'General'}` : ticketType;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://resethtx.com';

  const htmlContent = `
    <div style="font-family: sans-serif; background: #000; color: #fff; padding: 20px; text-align: center;">
      <div style="margin-bottom: 20px;">
        <img src="${baseUrl}/logos/logo-main.png" alt="Reset HTX" style="max-width: 250px; height: auto;" />
      </div>
      <p style="font-size: 18px; color: #ccc;">Your Booking is Confirmed</p>
      
      <div style="background: #111; border: 1px solid #333; padding: 20px; margin: 20px auto; border-radius: 8px; max-width: 500px; text-align: left;">
        <h2 style="margin: 0 0 10px; color: #fff; text-align: center;">${eventName}</h2>
        <p style="color: #888; margin: 0 0 20px; text-align: center;">${new Date(date).toDateString()}</p>
        <p style="text-align: center; color: #D4AF37; font-size: 20px; font-weight: bold; margin-bottom: 20px;">Booking ID: ${bookingRef || orderId || 'N/A'}</p>
        <hr style="border-color: #333; margin: 20px 0;" />
        <p><strong>Guest:</strong> ${name}</p>
        <p><strong>Type:</strong> ${typeDisplay}</p>
        <p><strong>Quantity:</strong> ${quantity}</p>
        <p><strong>Total:</strong> $${totalAmount}</p>
      </div>
      ${bookingRef ? `
      <div style="margin-top: 30px; text-align: center;">
        <p style="color: #ccc; font-size: 14px;">Need to change your plans?</p>
        <a href="${baseUrl}/cancel?ref=${bookingRef}&email=${encodeURIComponent(to)}" 
           style="background-color: #333; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
           Cancel Booking
        </a>
      </div>` : ''}
      <div style="margin-top: 30px;">
        <img src="${baseUrl}/logos/r_logo.png" alt="R Icon" style="max-width: 40px; height: auto; opacity: 0.8;" />
      </div>
      <p style="font-size: 12px; color: #666; margin-top: 10px;">Please present this email at the door. 21+ to enter.</p>
    </div>
  `;
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Reset HTX" <sales@resethtx.com>',
      to,
      subject: `Booking Confirmed: ${eventName}`,
      html: htmlContent,
    });
    console.log(`✅ Email sent to ${to}`);
  } catch (error) {
    console.error('❌ Error sending email:', error);
  }
};

export const sendAdminBookingNotification = async (details: any) => {
  const transporter = getTransporter();
  if (!transporter) return;
  const { eventName, date, ticketType, quantity, totalAmount, name, email, tableSelection, bookingRef } = details;
  const typeDisplay = ticketType === 'table_reservation' ? `Table Reservation: ${tableSelection || 'General'}` : ticketType;

  const htmlContent = `
    <h2>New Booking Received</h2>
    <p><strong>Booking ID:</strong> ${bookingRef || 'N/A'}</p>
    <p><strong>Event:</strong> ${eventName}</p>
    <p><strong>Date:</strong> ${new Date(date).toDateString()}</p>
    <p><strong>Guest Name:</strong> ${name}</p>
    <p><strong>Guest Email:</strong> ${email}</p>
    <p><strong>Ticket Type:</strong> ${typeDisplay}</p>
    <p><strong>Quantity:</strong> ${quantity}</p>
    <p><strong>Total Amount:</strong> $${totalAmount}</p>
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Reset HTX System" <sales@resethtx.com>',
      to: process.env.ADMIN_EMAIL || process.env.SMTP_USER || 'sales@resethtx.com', // Send to admin
      subject: `🚨 New Booking: ${eventName} - ${name}`,
      html: htmlContent,
    });
    console.log(`✅ Admin booking notification sent`);
  } catch (error) {
    console.error('❌ Error sending admin notification:', error);
  }
};

export const sendCustomerCancellation = async (to: string, details: any) => {
  const transporter = getTransporter();
  if (!transporter) return;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://resethtx.com';

  const htmlContent = `
    <div style="font-family: sans-serif; background: #000; color: #fff; padding: 20px; text-align: center;">
      <div style="margin-bottom: 20px;">
        <img src="${baseUrl}/logos/logo-main.png" alt="Reset HTX" style="max-width: 250px; height: auto;" />
      </div>
      <p style="font-size: 18px; color: #ccc;">Booking Cancelled & Refunded</p>
      <div style="background: #111; border: 1px solid #333; padding: 20px; margin: 20px auto; border-radius: 8px; max-width: 500px; text-align: left;">
        <p>Hi ${details.name},</p>
        <p>Your booking for <strong>${details.eventName}</strong> has been successfully cancelled.</p>
        <p>A refund has been initiated to your original payment method. Please allow 5-10 business days for the funds to appear.</p>
      </div>
      <div style="margin-top: 30px;">
        <img src="${baseUrl}/logos/r_logo.png" alt="R Icon" style="max-width: 40px; height: auto; opacity: 0.8;" />
      </div>
      <p style="font-size: 12px; color: #666; margin-top: 10px;">If you have any questions, please reply to this email.</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Reset HTX" <sales@resethtx.com>',
      to,
      subject: `Booking Cancelled: ${details.eventName}`,
      html: htmlContent,
    });
  } catch (error) {
    console.error('❌ Error sending cancellation email:', error);
  }
};

export const sendAdminCancellation = async (details: any) => {
  const transporter = getTransporter();
  if (!transporter) return;

  const htmlContent = `
    <h2>Booking Cancelled</h2>
    <p>A booking has been cancelled and refunded by the customer.</p>
    <p><strong>Event:</strong> ${details.eventName}</p>
    <p><strong>Guest Name:</strong> ${details.name}</p>
    <p><strong>Guest Email:</strong> ${details.email}</p>
    <p><strong>Order ID:</strong> ${details.orderId}</p>
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Reset HTX System" <sales@resethtx.com>',
      to: process.env.ADMIN_EMAIL || process.env.SMTP_USER || 'sales@resethtx.com',
      subject: `⚠️ Booking Cancelled: ${details.eventName} - ${details.name}`,
      html: htmlContent,
    });
  } catch (error) {
    console.error('❌ Error sending admin cancellation notification:', error);
  }
};
