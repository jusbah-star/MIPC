# MIPC Digital Campus — iOS & Android

This directory contains the native MIPC mobile application built with Expo and React Native. It is not a WebView wrapper: it authenticates directly with Supabase, persists a native session, and reads the same RLS-protected data as the web portal.

## Current mobile milestone

- Student / Staff / Administrator portal selection.
- Students authenticate with registration number + registered email before an OTP is issued.
- Staff and administrators are checked against their stored active MIPC role before an OTP is issued.
- Email OTPs are generated server-side and delivered through the existing MIPC SMTP channel.
- Native Supabase session persistence on iOS and Android.
- Role-aware home screen and campus announcements.
- Student / academic course lists and published lesson materials.
- Examination schedule/status visibility.
- Profile, role details, sign-out and safe handoff to the full web portal for workflows not native yet.

## Local setup

1. Copy `.env.example` to `.env`.
2. Set the public Supabase publishable/anon key used by the MIPC project. Never place `SUPABASE_SERVICE_ROLE_KEY` in this directory.
3. Run `npm install` inside `mobile/`.
4. Run `npm run ios` or `npm run android`.

The public API URL defaults to `https://mipc-rosy.vercel.app` and can be overridden with `EXPO_PUBLIC_MIPC_API_URL` for staging.

## Verification

`npm run verify` runs TypeScript checking and produces both iOS and Android JavaScript bundles. EAS profiles are defined in `eas.json` for development, internal preview and production store builds.
