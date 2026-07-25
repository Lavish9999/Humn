'use client';

import { useState } from 'react';
import { Download, ShieldCheck, SlidersHorizontal, Trash2 } from 'lucide-react';
import { createBrowserSupabaseClient } from '@human/database/browser';

type Settings = {
  strict_human_only: boolean;
  include_awaiting_verification: boolean;
  hide_commercial: boolean;
  show_local: boolean;
};

export function SettingsClient({
  userId,
  initialSettings,
}: {
  userId: string;
  initialSettings: Settings;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMessage('');
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase
      .from('user_settings')
      .update(settings)
      .eq('user_id', userId);
    setBusy(false);
    setMessage(error ? error.message : 'Preferences saved.');
  }

  async function exportData() {
    setBusy(true);
    setMessage('');
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase.functions.invoke('export-user-data');
    setBusy(false);
    if (error) return setMessage(error.message);

    const blob = new Blob([JSON.stringify(data?.data ?? data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `humn-export-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAccount() {
    const confirmed = window.confirm(
      'Permanently delete your account, Works, Collections, private evidence, and sessions? This cannot be undone.',
    );
    if (!confirmed) return;

    setBusy(true);
    setMessage('');
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.functions.invoke('delete-account');
    if (error) {
      setBusy(false);
      return setMessage(error.message);
    }
    window.location.href = '/';
  }

  const rows: [keyof Settings, string, string][] = [
    ['strict_human_only', 'Strongly verified only', 'Hide content without strong origin evidence.'],
    ['include_awaiting_verification', 'Include awaiting verification', 'Show declared human-made work while it is still being reviewed.'],
    ['hide_commercial', 'Hide commercial content', 'Reduce product and service promotion in Discover.'],
    ['show_local', 'Show local creators', 'Use your selected city or service area, never a precise private address.'],
  ];

  const success = message.toLowerCase().includes('saved');

  return (
    <div className="settings-layout">
      <div className="settings-main">
        <section className="panel">
          <div className="panel-body">
            <div className="panel-header">
              <span className="panel-icon" aria-hidden="true"><SlidersHorizontal size={19} /></span>
              <div>
                <h2 className="panel-title">Content preferences</h2>
                <p className="panel-copy">Tune the balance between strict verification and fresh discovery.</p>
              </div>
            </div>

            <div className="setting-list">
              {rows.map(([key, title, description]) => (
                <label className="setting-row" key={key}>
                  <span className="setting-copy">
                    <span className="setting-title">{title}</span>
                    <span className="setting-description">{description}</span>
                  </span>
                  <span className="switch-control">
                    <input
                      className="switch-input"
                      type="checkbox"
                      checked={settings[key]}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          [key]: event.target.checked,
                        }))
                      }
                    />
                    <span className="switch-track" aria-hidden="true">
                      <span className="switch-thumb" />
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <div className="panel-actions">
              <button className="button" onClick={save} disabled={busy}>
                {busy ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </section>

        {message && (
          <div className={`status-banner${success ? ' success' : ''}`} role="status">
            {message}
          </div>
        )}
      </div>

      <aside className="settings-side">
        <section className="panel">
          <div className="panel-body">
            <div className="panel-header">
              <span className="panel-icon warm" aria-hidden="true"><Download size={19} /></span>
              <div>
                <h2 className="panel-title">Your data</h2>
                <p className="panel-copy">Download a copy of the account information currently held by Humn.</p>
              </div>
            </div>
            <div className="panel-actions">
              <button className="button secondary" onClick={exportData} disabled={busy}>
                <Download size={17} /> Export data
              </button>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-body">
            <div className="panel-header">
              <span className="panel-icon" aria-hidden="true"><ShieldCheck size={19} /></span>
              <div>
                <h2 className="panel-title">Privacy by default</h2>
                <p className="panel-copy">Private verification evidence is never shown publicly unless you choose to publish it.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="panel danger-panel">
          <div className="panel-body">
            <div className="panel-header">
              <span className="panel-icon danger" aria-hidden="true"><Trash2 size={19} /></span>
              <div>
                <h2 className="panel-title">Delete account</h2>
                <p className="panel-copy">Permanently remove your account and owned data. This cannot be undone.</p>
              </div>
            </div>
            <div className="panel-actions">
              <button className="button danger" onClick={deleteAccount} disabled={busy}>
                Delete account
              </button>
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
}
