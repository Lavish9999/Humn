'use client';
import { useState } from 'react';
import { createBrowserSupabaseClient } from '@human/database/browser';

type Settings = {
  strict_human_only: boolean;
  include_awaiting_verification: boolean;
  hide_commercial: boolean;
  show_local: boolean;
};

export function SettingsClient({ userId, initialSettings }: { userId: string; initialSettings: Settings }) {
  const [settings, setSettings] = useState(initialSettings);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setMessage('');
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.from('user_settings').update(settings).eq('user_id', userId);
    setBusy(false); setMessage(error ? error.message : 'Settings saved.');
  }

  async function exportData() {
    setBusy(true); setMessage('');
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase.functions.invoke('export-user-data');
    setBusy(false);
    if (error) return setMessage(error.message);
    const blob = new Blob([JSON.stringify(data?.data ?? data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `human-export-${new Date().toISOString().slice(0, 10)}.json`; anchor.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAccount() {
    const confirmed = window.confirm('Permanently delete your account, Works, Collections, private evidence, and sessions? This cannot be undone.');
    if (!confirmed) return;
    setBusy(true); setMessage('');
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.functions.invoke('delete-account');
    if (error) { setBusy(false); return setMessage(error.message); }
    window.location.href = '/';
  }

  const rows: [keyof Settings, string, string][] = [
    ['strict_human_only', 'Strongly verified only', 'Hide content without strong origin evidence.'],
    ['include_awaiting_verification', 'Include awaiting verification', 'Allow declared human-made work that is still being reviewed.'],
    ['hide_commercial', 'Hide commercial content', 'Reduce product and service promotion.'],
    ['show_local', 'Show local creators', 'Use your selected city or service area, never a private precise address.'],
  ];

  return <div style={{ display: 'grid', gap: 18, maxWidth: 720 }}>
    <section className="promise-card"><h3>Content preferences</h3><div className="form">{rows.map(([key, title, description]) => <label key={key} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}><input type="checkbox" checked={settings[key]} onChange={(event) => setSettings((current) => ({ ...current, [key]: event.target.checked }))} style={{ width: 20, height: 20 }} /><span><strong>{title}</strong><br/><span style={{ color: 'var(--muted)' }}>{description}</span></span></label>)}<button className="button" onClick={save} disabled={busy}>Save preferences</button></div></section>
    <section className="promise-card"><h3>Your data</h3><p style={{ color: 'var(--muted)' }}>Download the account information currently held by the platform.</p><button className="button secondary" onClick={exportData} disabled={busy}>Export my data</button></section>
    <section className="promise-card" style={{ borderColor: 'var(--danger)' }}><h3>Delete account</h3><p style={{ color: 'var(--muted)' }}>Permanent deletion removes account access and owned data through the server-side deletion flow.</p><button className="button" style={{ background: 'var(--danger)' }} onClick={deleteAccount} disabled={busy}>Delete permanently</button></section>
    {message && <p className={message.includes('saved') ? '' : 'notice'} role="status">{message}</p>}
  </div>;
}
