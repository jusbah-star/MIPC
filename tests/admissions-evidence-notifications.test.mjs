import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path) => readFile(join(root, path), 'utf8');

const [
  applyPage,
  uploadRoute,
  applyRoute,
  documentRoute,
  mailSource,
  registrarActions,
  adminActions,
  registrarPage,
  adminPage,
  migration
] = await Promise.all([
  read('src/app/(public)/admissions/apply/page.tsx'),
  read('src/app/api/admissions/diploma-upload/route.ts'),
  read('src/app/api/admissions/apply/route.ts'),
  read('src/app/api/admissions/document/[applicationId]/route.ts'),
  read('src/lib/application-mail.ts'),
  read('src/app/(portal)/registrar/actions.ts'),
  read('src/app/(portal)/admin/applications/actions.ts'),
  read('src/app/(portal)/registrar/applications/page.tsx'),
  read('src/app/(portal)/admin/applications/page.tsx'),
  read('supabase/migrations/0018_admissions_evidence_and_notifications.sql')
]);

test('application form requires secondary studies, national result and diploma', () => {
  assert.match(applyPage, /secondaryFieldOfStudy/);
  assert.match(applyPage, /nationalExamResult/);
  assert.match(applyPage, /Secondary diploma/);
  assert.match(applyPage, /application\/pdf/);
  assert.match(applyPage, /image\/jpeg/);
  assert.match(applyPage, /image\/png/);
  assert.match(applyPage, /MAX_DIPLOMA_SIZE = 8 \* 1024 \* 1024/);
  assert.match(applyPage, /uploadToSignedUrl/);
});

test('diploma upload uses a private signed-upload ticket and strict file limits', () => {
  assert.match(uploadRoute, /admission-diplomas/);
  assert.match(uploadRoute, /createSignedUploadUrl/);
  assert.match(uploadRoute, /8 \* 1024 \* 1024/);
  assert.match(uploadRoute, /'application\/pdf'/);
  assert.match(uploadRoute, /'image\/jpeg'/);
  assert.match(uploadRoute, /'image\/png'/);
});

test('application API validates academic evidence and verifies stored diploma before insert', () => {
  assert.match(applyRoute, /secondaryFieldOfStudy/);
  assert.match(applyRoute, /nationalExamResult/);
  assert.match(applyRoute, /diplomaPath/);
  assert.match(applyRoute, /storage\.from\(DIPLOMA_BUCKET\)\.list/);
  assert.match(applyRoute, /documents_path: diplomaPath/);
  assert.match(applyRoute, /deliverApplicationNotifications/);
});

test('database migration keeps diploma storage private and queues application email events', () => {
  assert.match(migration, /secondary_field_of_study/);
  assert.match(migration, /national_exam_result/);
  assert.match(migration, /application_email_notifications/);
  assert.match(migration, /event in \('submitted','approved','rejected'\)/);
  assert.match(migration, /'admission-diplomas'/);
  assert.match(migration, /false,\s*8388608/);
  assert.match(migration, /applications_queue_email_notification/);
  assert.match(migration, /drop policy if exists "anyone can submit a pending application"/);
  assert.match(migration, /revoke all on public\.application_email_notifications from public, anon, authenticated/);
});

test('notification delivery covers received, approved and declined decisions without embedding credentials', () => {
  assert.match(mailSource, /MIPC application received/);
  assert.match(mailSource, /MIPC application approved/);
  assert.match(mailSource, /MIPC application decision/);
  assert.match(mailSource, /waiting for review and confirmation/);
  assert.match(mailSource, /MIPC_SMTP_USER/);
  assert.match(mailSource, /MIPC_SMTP_PASS/);
  assert.doesNotMatch(mailSource, /AIza|sb_secret_|ghp_|-----BEGIN/);
});

test('Registrar and Principal decisions both attempt queued notification delivery', () => {
  for (const source of [registrarActions, adminActions]) {
    assert.match(source, /deliverApplicationNotifications/);
    assert.match(source, /approveApplication/);
    assert.match(source, /rejectApplication/);
  }
  assert.match(registrarActions, /retryApplicationEmails/);
  assert.match(adminActions, /retryApplicationEmails/);
});

test('only Registrar or Principal can obtain short-lived diploma review links', () => {
  assert.match(documentRoute, /requireActiveGovernanceRole\(\['registrar', 'admin'\]\)/);
  assert.match(documentRoute, /createSignedUrl\(application\.documents_path, 120/);
  assert.match(documentRoute, /NextResponse\.redirect/);
});

test('Registrar and Principal reviews expose evidence and notification state', () => {
  for (const source of [registrarPage, adminPage]) {
    assert.match(source, /secondary_field_of_study/);
    assert.match(source, /national_exam_result/);
    assert.match(source, /documents_path/);
    assert.match(source, /application_email_notifications/);
    assert.match(source, /Open private diploma evidence/);
    assert.match(source, /Retry email/);
  }
});
