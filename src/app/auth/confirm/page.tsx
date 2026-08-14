import Link from 'next/link';
import { confirmEmailLink } from './actions';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default async function ConfirmEmailPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const tokenHash = first(params.token_hash).trim();
  const type = first(params.type).trim();
  const ready = Boolean(tokenHash && type === 'email');

  return (
    <main className="min-h-screen bg-[#f4f7f5] px-5 py-10">
      <div className="mx-auto mt-16 max-w-md rounded-[1.75rem] border border-mipc-navy-900/10 bg-white p-8 shadow-academic">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-mipc-green-700">Secure campus access</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-mipc-navy-950">Confirm MIPC sign-in</h1>

        {ready ? (
          <>
            <p className="mt-4 text-sm leading-6 text-ink-500">
              Your email address has reached the MIPC confirmation step. Continue below to verify the one-time credential, create your secure session, and open the workspace assigned to your account.
            </p>
            <form action={confirmEmailLink} className="mt-7">
              <input type="hidden" name="token_hash" value={tokenHash} />
              <input type="hidden" name="type" value="email" />
              <button className="mipc-button-primary w-full !min-h-12 !bg-mipc-green-700">
                Continue to MIPC
              </button>
            </form>
            <p className="mt-4 text-xs leading-5 text-ink-500">
              This extra confirmation prevents email security scanners from consuming your one-time sign-in credential before you use it.
            </p>
          </>
        ) : (
          <>
            <p className="mt-4 text-sm leading-6 text-ink-500">
              This sign-in link is incomplete or has already been used. Return to the portal and request a new secure link.
            </p>
            <Link href="/login" className="mipc-button-primary mt-7 flex w-full items-center justify-center !min-h-12 !bg-mipc-green-700">
              Request a new sign-in link
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
