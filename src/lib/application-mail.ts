import 'server-only';

import { randomUUID } from 'node:crypto';
import tls from 'node:tls';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://mipc-rosy.vercel.app';

type NotificationEvent = 'submitted' | 'approved' | 'rejected';
type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  envelopeFrom: string;
  headerFrom: string;
  replyTo: string | null;
  fromName: string;
};

function smtpConfig(): SmtpConfig | null {
  const user = process.env.MIPC_SMTP_USER?.trim();
  const pass = process.env.MIPC_SMTP_PASS?.trim();
  if (!user || !pass) return null;

  const host = process.env.MIPC_SMTP_HOST?.trim() || 'smtp.gmail.com';
  const port = Number(process.env.MIPC_SMTP_PORT || '465');
  if (port !== 465) throw new Error('MIPC SMTP currently requires implicit TLS on port 465.');

  const configuredFrom = process.env.MIPC_SMTP_FROM?.trim() || user;
  const isGmailSmtp = host.toLowerCase() === 'smtp.gmail.com';
  const headerFrom = isGmailSmtp ? user : configuredFrom;
  const replyTo = process.env.MIPC_SMTP_REPLY_TO?.trim() || (configuredFrom !== headerFrom ? configuredFrom : null);

  return {
    host,
    port,
    user,
    pass,
    envelopeFrom: isGmailSmtp ? user : configuredFrom,
    headerFrom,
    replyTo,
    fromName: process.env.MIPC_SMTP_FROM_NAME?.trim() || 'MIPC Admissions'
  };
}

function waitForReply(socket: tls.TLSSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timeout = setTimeout(() => finish(new Error('SMTP server timed out.')), 15_000);

    function cleanup() {
      clearTimeout(timeout);
      socket.off('data', onData);
      socket.off('error', onError);
      socket.off('close', onClose);
    }

    function finish(error?: Error, value?: string) {
      cleanup();
      if (error) reject(error);
      else resolve(value || buffer);
    }

    function onData(chunk: Buffer) {
      buffer += chunk.toString('utf8');
      const completeLines = buffer.split(/\r?\n/).filter(Boolean);
      const finalLine = [...completeLines].reverse().find((line) => /^\d{3} /.test(line));
      if (finalLine) finish(undefined, buffer);
    }

    function onError(error: Error) { finish(error); }
    function onClose() { finish(new Error('SMTP connection closed unexpectedly.')); }

    socket.on('data', onData);
    socket.once('error', onError);
    socket.once('close', onClose);
  });
}

function responseCode(response: string) {
  const lines = response.split(/\r?\n/).filter(Boolean);
  const finalLine = [...lines].reverse().find((line) => /^\d{3} /.test(line));
  return finalLine ? Number(finalLine.slice(0, 3)) : 0;
}

function finalResponseLine(response: string) {
  return [...response.split(/\r?\n/).filter(Boolean)].reverse().find((line) => /^\d{3} /.test(line)) || '';
}

async function command(socket: tls.TLSSocket, value: string, expected: number | number[]) {
  const reply = waitForReply(socket);
  socket.write(`${value}\r\n`);
  const response = await reply;
  const code = responseCode(response);
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(code)) throw new Error(`SMTP rejected a command with status ${code || 'unknown'}.`);
  return response;
}

function cleanHeader(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

async function sendSmtpMail(config: SmtpConfig, to: string, subject: string, text: string) {
  const socket = tls.connect({ host: config.host, port: config.port, servername: config.host, rejectUnauthorized: true });
  socket.setTimeout(20_000, () => socket.destroy(new Error('SMTP connection timed out.')));
  const greetingPromise = waitForReply(socket);

  await new Promise<void>((resolve, reject) => {
    socket.once('secureConnect', resolve);
    socket.once('error', reject);
  });

  const greeting = await greetingPromise;
  if (responseCode(greeting) !== 220) {
    socket.destroy();
    throw new Error('SMTP server did not accept the connection.');
  }

  const messageId = `${randomUUID()}@mipc-rosy.vercel.app`;

  try {
    await command(socket, 'EHLO mipc-rosy.vercel.app', 250);
    await command(socket, 'AUTH LOGIN', 334);
    await command(socket, Buffer.from(config.user).toString('base64'), 334);
    await command(socket, Buffer.from(config.pass).toString('base64'), 235);
    await command(socket, `MAIL FROM:<${cleanHeader(config.envelopeFrom)}>`, 250);
    await command(socket, `RCPT TO:<${cleanHeader(to)}>`, [250, 251]);
    await command(socket, 'DATA', 354);

    const normalized = text.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
    const headers = [
      `From: ${cleanHeader(config.fromName)} <${cleanHeader(config.headerFrom)}>`,
      `To: <${cleanHeader(to)}>`,
      `Subject: ${cleanHeader(subject)}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${messageId}>`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      'Auto-Submitted: auto-generated',
      'X-Auto-Response-Suppress: All'
    ];
    if (config.replyTo) headers.splice(3, 0, `Reply-To: <${cleanHeader(config.replyTo)}>`);

    const message = [...headers, '', normalized, '.'].join('\r\n');
    const reply = waitForReply(socket);
    socket.write(`${message}\r\n`);
    const response = await reply;
    if (responseCode(response) !== 250) throw new Error('SMTP server did not accept the message.');
    await command(socket, 'QUIT', 221);
    return { messageId, providerResponse: finalResponseLine(response) };
  } finally {
    socket.end();
  }
}

function notificationCopy(event: NotificationEvent, application: any) {
  const name = String(application.full_name || 'Applicant').trim();
  const reference = String(application.id);
  const trackUrl = `${SITE_URL}/admissions/status`;

  if (event === 'submitted') {
    return {
      subject: 'MIPC Admissions — Application Received',
      text: `Dear ${name},\n\nYour application to Muhabura Integrated Polytechnic College (MIPC) has been received successfully and is waiting for review and confirmation by the Admissions/Registrar team.\n\nApplication reference: ${reference}\n\nPlease keep this reference private. We will email you again when your application is approved or declined.\n\nTrack your application: ${trackUrl}\n\nMIPC Admissions\nMusanze, Rwanda`
    };
  }

  if (event === 'approved') {
    return {
      subject: 'MIPC Admissions — Application Approved',
      text: `Dear ${name},\n\nYour application to Muhabura Integrated Polytechnic College has been approved.\n\nApplication reference: ${reference}\n\nThe Registrar will now complete your official student registration, including your registration number and academic placement. Portal access becomes available after registration is completed.\n\nIf you do not receive this decision message promptly, you can verify your application and request another copy here: ${trackUrl}\n\nMIPC Admissions\nMusanze, Rwanda`
    };
  }

  return {
    subject: 'MIPC Admissions — Application Decision',
    text: `Dear ${name},\n\nYour application to Muhabura Integrated Polytechnic College has been reviewed. We are sorry to inform you that it was not approved for this intake.\n\nApplication reference: ${reference}\n\nYou may contact MIPC Admissions if you need clarification, and you may apply again in a future intake where eligible.\n\nIf you do not receive this decision message promptly, you can verify your application and request another copy here: ${trackUrl}\n\nMIPC Admissions\nMusanze, Rwanda`
  };
}

export async function deliverApplicationNotifications(admin: any, applicationId: string) {
  const { data: application, error: applicationError } = await admin
    .from('applications')
    .select('id,full_name,email')
    .eq('id', applicationId)
    .single();
  if (applicationError || !application) return;

  const { data: notifications, error: notificationError } = await admin
    .from('application_email_notifications')
    .select('id,event,recipient_email,status,attempts')
    .eq('application_id', applicationId)
    .in('status', ['pending', 'failed'])
    .order('created_at');
  if (notificationError || !notifications?.length) return;

  let config: SmtpConfig | null = null;
  try {
    config = smtpConfig();
  } catch (error) {
    console.error('MIPC SMTP configuration is invalid', { message: error instanceof Error ? error.message : 'Unknown SMTP configuration error' });
  }

  for (const notification of notifications as any[]) {
    if (!config) {
      await admin.from('application_email_notifications').update({
        status: 'failed',
        last_error: 'SMTP delivery is not configured in the application environment.',
        updated_at: new Date().toISOString()
      }).eq('id', notification.id);
      continue;
    }

    const copy = notificationCopy(notification.event as NotificationEvent, application);
    try {
      const handoff = await sendSmtpMail(config, notification.recipient_email, copy.subject, copy.text);
      await admin.from('application_email_notifications').update({
        status: 'sent',
        attempts: Number(notification.attempts || 0) + 1,
        last_error: null,
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', notification.id);
      console.info('Application notification accepted by SMTP provider', {
        applicationId,
        event: notification.event,
        messageId: handoff.messageId,
        providerResponse: handoff.providerResponse
      });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : 'Email delivery failed.';
      console.error('Application notification delivery failed', { applicationId, event: notification.event, message });
      await admin.from('application_email_notifications').update({
        status: 'failed',
        attempts: Number(notification.attempts || 0) + 1,
        last_error: message,
        updated_at: new Date().toISOString()
      }).eq('id', notification.id);
    }
  }
}
