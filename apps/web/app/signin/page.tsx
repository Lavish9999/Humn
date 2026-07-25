import { redirect } from 'next/navigation';
import { getServerSupabase } from '../../lib/supabase/server';
import { safeInternalRedirect } from '../../lib/auth/redirects';

type SignInSearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}


export default async function SignInAliasPage({
  searchParams,
}: {
  searchParams: Promise<SignInSearchParams>;
}) {
  const params = await searchParams;
  const nextPath = safeInternalRedirect(firstParam(params.next));
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect(nextPath);
  }

  redirect(`/auth?next=${encodeURIComponent(nextPath)}`);
}

