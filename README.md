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
- Shared database-backed rate limiting for sensitive public and assessment endpoints

## Local setup

1. Copy `.env.local.example` to `.env.local` and add the Supabase project credentials.
2. Apply every SQL file in `supabase/migrations` in numeric order.
3. Install dependencies with `npm install`.
4. Start locally with `npm run dev`.

For an intentional local demonstration without Supabase, set `NEXT_PUBLIC_MIPC_DEMO_MODE=true`. Demo mode is disabled when `NODE_ENV=production`; production portal and sensitive API routes fail closed when the Supabase backend is unavailable.

Production deployments require `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the server-only `SUPABASE_SERVICE_ROLE_KEY`. The service-role credential is used by privileged server workflows and the distributed rate-limit function; it must never be exposed to client code.

## Verification

Run `npm run verify` before release. It checks TypeScript, security contracts and the optimized production build. GitHub Actions runs the same verification on pushes to `main`, hardening branches, and pull requests.

## Compliance note

The implementation provides consent evidence, access control, audit records, data-subject request intake and data minimisation controls designed to support Rwanda Law No. 058/2021 and higher-education recordkeeping. Deployment still requires MIPC to complete its controller registration, retention schedule, privacy contacts, infrastructure review and legal/compliance sign-off.
