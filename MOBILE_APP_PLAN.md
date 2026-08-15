# MIPC iOS & Android Delivery Plan

## Architecture

MIPC uses one Expo/React Native codebase for iOS and Android while keeping Next.js for the web portal. Both clients use the same Supabase Auth identity, PostgreSQL database, Storage and Row Level Security. Privileged operations remain server/RPC owned; the app never receives a service-role credential.

## Milestone 1 — native foundation (implemented)

- Expo SDK 57 / React Native 0.86 application.
- iOS bundle ID and Android package: `rw.ac.mipc.campus`.
- Mobile-specific OTP authentication with the existing student registration-number and staff/admin role checks.
- Persistent native Supabase sessions.
- Role-aware navigation, announcements, courses, lesson resources, exam visibility and account controls.
- Dedicated mobile CI that typechecks and bundles both platforms.

## Milestone 2 — complete student learning flow

- Authenticated attached-file download using short-lived signed Storage URLs.
- Native examination room using the existing per-student rate limits and set-based autosave RPCs.
- Dirty-answer autosave, offline draft queue, reconnect synchronization and authoritative final submission.
- Assignment submission/upload, grade/result view and course progress.
- Local caching of course metadata and previously opened learning materials.

## Milestone 3 — lecturer & HOD workspace

- Create lessons and publish books, handouts, questionnaires, assignments, slides and references.
- Secure camera/file-picker uploads through signed upload tickets.
- Class rosters, class-specific material targeting and lecturer assignment visibility.
- Assessment creation, grading queue and result release using existing server-owned authorization.
- HOD class, lecturer and lesson governance workflows.

## Milestone 4 — Registrar, Finance & Principal

- Paginated student search/registry and admissions review.
- Cohort/course management and controlled student provisioning.
- Student finance accounts, payment history and authorized finance actions.
- Principal governance, staff management, audit visibility and operational dashboards.
- Native forms call the same service-role-only server/RPC workflows; no privileged SQL writes are performed directly from the phone.

## Milestone 5 — mobile platform features

- Expo push notifications for announcements, exam reminders, material releases, admissions decisions and finance notices.
- Device biometrics as a local app-unlock layer after a valid Supabase session exists.
- Deep links for course, material and notification destinations.
- Background refresh for time-sensitive campus notices within platform limits.
- Accessibility review, low-bandwidth behavior, crash reporting and analytics with privacy controls.

## Release path

1. Internal EAS development builds for staff testing.
2. Android internal/closed testing and iOS TestFlight.
3. Security and 100/250/500/1,000 concurrent-session staging tests against the shared backend.
4. Store metadata, privacy disclosures, screenshots and support URLs.
5. Google Play production and Apple App Store production submissions.

Apple Developer Program and Google Play Console ownership/credentials are required only when signing and submitting the final production binaries; they are not stored in the repository.
