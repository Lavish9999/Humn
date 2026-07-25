import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  RECOVERY_GRANT_COOKIE,
  verifyRecoveryGrant,
} from '../../../lib/auth/recovery';
import { getServerSupabase } from '../../../lib/supabase/server';
import { UpdatePasswordForm } from './update-password-form';

export const dynamic = 'force-dynamic';

export default async function UpdatePasswordPage() {
  const supabase = await getServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  const cookieStore = await cookies();
  const grant = cookieStore.get(RECOVERY_GRANT_COOKIE)?.value;

  if (error || !user || !verifyRecoveryGrant(grant, user.id)) {
    redirect(
      '/auth/reset?error=Start%20from%20a%20valid%20password%20reset%20link%20to%20choose%20a%20new%20password.',
    );
  }

  return <UpdatePasswordForm />;
}
