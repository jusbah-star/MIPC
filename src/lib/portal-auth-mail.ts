import 'server-only';

import { randomUUID } from 'node:crypto';
import tls from 'node:tls';

type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  envelopeFrom: string;
  headerFrom: string;
  replyTo: string | null;
};

type PortalMailInput = {
  to: string;
  signInUrl: string;
};

type PortalOtpMailInput = {
  to: string;
  otp: string;
};

type TextMailInput = {
  to: string;
  subject: string;
  text: string;
};

function smtpConfig(): SmtpConfig {
  const user = process.env.MIPC_SMTP_USER?.trim();
  const pass = process.env.MIPC_SMTP_PASS?.trim();
  if (!user || !pass) throw new Error('MIPC SMTP is not configured.');

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
    replyTo
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
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      if ([...lines].reverse().some((line) => /^\d{3} /.test(line))) finish(undefined, buffer);
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
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(responseCode(response))) throw new Error(`SMTP rejected a command with status ${responseCode(response) || 'unknown'}.`);
  return response;
}

function cleanHeader(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

async function sendPortalTextEmail({ to, subject, text }: TextMailInput) {
  const config = smtpConfig();
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
      `From: MIPC Portal <${cleanHeader(config.headerFrom)}>`,
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

export async function sendPortalSignInEmail({ to, signInUrl }: PortalMailInput) {
  return sendPortalTextEmail({
    to,
    subject: 'MIPC Portal — Secure Sign-In Link',
    text: `Hello,\n\nA secure sign-in link was requested for your MIPC campus account.\n\nContinue to MIPC:\n${signInUrl}\n\nThis link is for one-time use. If you did not request it, you can ignore this email.\n\nMuhabura Integrated Polytechnic College (MIPC)\nMusanze, Rwanda`
  });
}

export async function sendPortalOtpEmail({ to, otp }: PortalOtpMailInput) {
  const code = String(otp).replace(/\s+/g, '').slice(0, 12);
  if (!/^\d{6,8}$/.test(code)) throw new Error('MIPC mobile sign-in code is invalid.');

  return sendPortalTextEmail({
    to,
    subject: 'MIPC Mobile — Your Sign-In Code',
    text: `Hello,\n\nUse this one-time code to sign in to the MIPC iOS or Android app:\n\n${code}\n\nEnter the code only inside the official MIPC Digital Campus app. It is for one-time use and expires automatically. If you did not request it, you can ignore this email.\n\nMuhabura Integrated Polytechnic College (MIPC)\nMusanze, Rwanda`
  });
}
