-- Add institutional governance roles in a dedicated migration so PostgreSQL
-- can safely use the new enum values in later transactions.
alter type public.user_role add value if not exists 'hod' after 'lecturer';
alter type public.user_role add value if not exists 'registrar' after 'hod';
alter type public.user_role add value if not exists 'finance' after 'registrar';
