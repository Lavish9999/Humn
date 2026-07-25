import { redirect } from 'next/navigation';
import { getServerSupabase } from '../../lib/supabase/server';
import { SettingsClient } from './settings-client';

export default async function SettingsPage() {
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/auth');
  const { data: settings } = await supabase.from('user_settings').select('*').eq('user_id', auth.user.id).single();
  const initialSettings = settings ?? { strict_human_only: false, include_awaiting_verification: true, hide_commercial: false, show_local: false };
  return <main className="shell section"><div className="section-head"><div><div className="eyebrow">You</div><h2>Settings and privacy</h2></div></div><SettingsClient userId={auth.user.id} initialSettings={initialSettings} /></main>;
}
