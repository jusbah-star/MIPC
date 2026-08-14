import type { createAdminClient } from '@/lib/supabase/server';

type AdminClient = ReturnType<typeof createAdminClient>;

const PAGE_SIZE = 1000;
const MAX_PAGES = 100;

export async function findAuthUserByEmail(admin: AdminClient, email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) {
      console.error('Supabase Auth directory lookup failed', { message: error.message, page });
      throw new Error('Student account lookup could not be completed.');
    }

    const match = data.users.find((user) => user.email?.trim().toLowerCase() === normalizedEmail);
    if (match) return match;
    if (data.users.length < PAGE_SIZE) return null;
  }

  throw new Error('Student account lookup exceeded the supported directory size.');
}
