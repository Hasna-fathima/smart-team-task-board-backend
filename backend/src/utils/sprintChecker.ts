import nodemailer from 'nodemailer';
import Sprint from '../models/Sprint';
import User from '../models/User';

const getTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.MAIL_SENDER_EMAIL,
      pass: process.env.GOOGLE_APP_PASSWORD,
    },
  });
};

const sendAlertToAdmins = async (subject: string, html: string) => {
  try {
    const admins = await User.find({ role: 'admin' });
    if (admins.length === 0) {
      console.log('[Sprint Checker] No admin users found to receive email alerts.');
      return;
    }

    const adminEmails = admins.map((a) => a.email);
    const transporter = getTransporter();

    await transporter.sendMail({
      from: `"Smart Task Board" <${process.env.MAIL_SENDER_EMAIL}>`,
      to: adminEmails.join(','),
      subject,
      html,
    });

    console.log(`[Sprint Checker] Expiry email sent successfully to: ${adminEmails.join(', ')}`);
  } catch (error: any) {
    console.error('[Sprint Checker] Failed to send email alert:', error.message);
  }
};

export const checkSprints = async () => {
  try {
    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // 1. Check for Sprints expiring in less than 24 hours (Warning)
    // Only where status is not completed and warning was not sent yet
    const warningSprints = await Sprint.find({
      status: { $ne: 'completed' },
      endDate: { $lte: oneDayFromNow, $gt: now },
      expiryWarningSent: { $ne: true }
    }).populate('workspace', 'name');

    for (const sprint of warningSprints) {
      const workspaceName = (sprint.workspace as any)?.name || 'Unknown Workspace';
      const subject = `[Smart Task Board] Sprint Expiration Warning: ${sprint.name}`;
      const html = `
        <h2>Sprint Expiry Warning (1 Day Remaining)</h2>
        <p>Hello Admin,</p>
        <p>The sprint <strong>${sprint.name}</strong> in workspace <strong>${workspaceName}</strong> is scheduled to expire in less than 24 hours.</p>
        <ul>
          <li><strong>Sprint Name:</strong> ${sprint.name}</li>
          <li><strong>Workspace:</strong> ${workspaceName}</li>
          <li><strong>End Date:</strong> ${sprint.endDate.toLocaleString()}</li>
          <li><strong>Current Status:</strong> ${sprint.status}</li>
        </ul>
        <p>Please review progress and update the status when complete.</p>
      `;

      await sendAlertToAdmins(subject, html);
      sprint.expiryWarningSent = true;
      await sprint.save();
    }

    // 2. Check for Sprints that have already expired (Alert)
    // Only where status is not completed and expiration alert was not sent yet
    const expiredSprints = await Sprint.find({
      status: { $ne: 'completed' },
      endDate: { $lte: now },
      expiryAlertSent: { $ne: true }
    }).populate('workspace', 'name');

    for (const sprint of expiredSprints) {
      const workspaceName = (sprint.workspace as any)?.name || 'Unknown Workspace';
      const subject = `[Smart Task Board] Sprint Expired Alert: ${sprint.name}`;
      const html = `
        <h2>Sprint Expired Alert (Action Required)</h2>
        <p>Hello Admin,</p>
        <p>The sprint <strong>${sprint.name}</strong> in workspace <strong>${workspaceName}</strong> has expired on <strong>${sprint.endDate.toLocaleString()}</strong> but its status is still not marked as <strong>completed</strong>.</p>
        <ul>
          <li><strong>Sprint Name:</strong> ${sprint.name}</li>
          <li><strong>Workspace:</strong> ${workspaceName}</li>
          <li><strong>Expired On:</strong> ${sprint.endDate.toLocaleString()}</li>
          <li><strong>Current Status:</strong> ${sprint.status}</li>
        </ul>
        <p>Please update this sprint to <strong>completed</strong> to close the sprint cycle.</p>
      `;

      await sendAlertToAdmins(subject, html);
      sprint.expiryAlertSent = true;
      await sprint.save();
    }
  } catch (error: any) {
    console.error('[Sprint Checker] Error in checking active sprints:', error.message);
  }
};

export const startSprintExpiryChecker = () => {
  console.log('[Sprint Checker] Background sprint checker started.');
  // Check on startup
  checkSprints();
  // Check every 2 minutes
  setInterval(checkSprints, 2 * 60 * 1000);
};
