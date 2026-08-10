# MIPC digital campus

A responsive public website, admissions service and learning portal for Muhabura Integrated Polytechnic College (MIPC), Musanze, Rwanda.

## What is included

- Public MIPC site with current institutional identity and programme information
- Admissions application and private status tracking
- Student courses, coursework and server-timed assessments
- Lecturer course bulletins, secure assessment creation and audited grading
- Administrator admissions, users, curriculum and audit views
- Rwanda data-protection rights request workflow
- Supabase row-level security and transactional PostgreSQL functions

## Local setup

1. Copy `.env.local.example` to `.env.local` and add the Supabase project credentials.
2. Apply every SQL file in `supabase/migrations` in numeric order.
3. Install dependencies with `npm install`.
4. Start locally with `npm run dev`.

If Supabase variables are absent, the application runs in a clearly separated in-memory demonstration mode. Demonstration data is never used as a fallback when a real Supabase project is configured.

## Verification

Run `npm run verify` before release. It checks TypeScript, security contracts and the optimized production build.

## Compliance note

The implementation provides consent evidence, access control, audit records, data-subject request intake and data minimisation controls designed to support Rwanda Law No. 058/2021 and higher-education recordkeeping. Deployment still requires MIPC to complete its controller registration, retention schedule, privacy contacts, infrastructure review and legal/compliance sign-off.
