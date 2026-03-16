const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

/**
 * Send leave status notification email
 */
const sendLeaveStatusEmail = async (to, name, status, leaveType, startDate, endDate) => {
  try {
    const color = status === 'approved' ? '#22c55e' : '#ef4444';
    await transporter.sendMail({
      from: `"Attendance System" <${process.env.EMAIL_USER}>`,
      to,
      subject: `Leave Request ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0F172A;color:#fff;padding:32px;border-radius:12px;">
          <h2 style="color:#14B8A6;margin-bottom:16px;">Leave Request Update</h2>
          <p>Dear <strong>${name}</strong>,</p>
          <p>Your <strong>${leaveType}</strong> leave from <strong>${startDate}</strong> to <strong>${endDate}</strong> has been
            <strong style="color:${color}">${status.toUpperCase()}</strong>.
          </p>
          <hr style="border-color:#1E293B;margin:24px 0"/>
          <p style="color:#64748b;font-size:12px;">Attendance Management System</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('Email error:', err.message);
  }
};

module.exports = { sendLeaveStatusEmail };
