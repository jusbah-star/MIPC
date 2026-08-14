import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path) => readFile(join(root, path), 'utf8');

const [layout, tailwind, mail, resendRoute, statusPage] = await Promise.all([
  read('src/app/layout.tsx'),
  read('tailwind.config.ts'),
  read('src/lib/application-mail.ts'),
  read('src/app/api/admissions/resend-decision/route.ts'),
  read('src/app/(public)/admissions/status/page.tsx')
]);

test('the site no longer loads a dedicated mono font', () => {
  assert.doesNotMatch(layout, /IBM_Plex_Mono/);
  assert.match(tailwind, /mono: \['var\(--font-sans\)'/);
});

test('gmail smtp keeps the authenticated identity aligned with the From envelope', () => {
  assert.match(mail, /isGmailSmtp/);
  assert.match(mail, /envelopeFrom: isGmailSmtp \? user : configuredFrom/);
  assert.match(mail, /headerFrom = isGmailSmtp \? user : configuredFrom/);
  assert.match(mail, /MIPC_SMTP_REPLY_TO/);
  assert.match(mail, /Application notification accepted by SMTP provider/);
});

test('applicants can securely resend a final decision only to the application email', () => {
  assert.match(resendRoute, /uuid\(body\.reference/);
  assert.match(resendRoute, /emailAddress\(body\.email\)/);
  assert.match(resendRoute, /admission-decision-resend/);
  assert.match(resendRoute, /3, 60 \* 60 \* 1000/);
  assert.match(resendRoute, /application\.status !== 'approved' && application\.status !== 'rejected'/);
  assert.match(resendRoute, /recipient_email: application\.email/);
  assert.match(resendRoute, /deliverApplicationNotifications/);
});

test('application status uses professional language and exposes decision resend', () => {
  assert.match(statusPage, /Check your application status/);
  assert.match(statusPage, /Resend decision email/);
  assert.match(statusPage, /Application approved/);
  assert.doesNotMatch(statusPage, /Admissions Ledger|Admitted & Matriculated|font-mono/);
});
