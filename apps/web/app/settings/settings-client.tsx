'use client';

import { useState } from 'react';
import { createBrowserSupabaseClient } from '@human/database/browser';
import { ToggleSwitch } from '../../components/toggle-switch';

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
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save() {
    setBusy(true);
    setMessage('');
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase
      .from('user_settings')
      .update(settings)
      .eq('user_id', userId);
    setBusy(false);
    setMessage(error ? error.message : 'Settings saved.');
  }

  async function exportData() {
    setBusy(true);
    setMessage('');
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase.functions.invoke('export-user-data');
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }

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
    setBusy(true);
    setMessage('');
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.functions.invoke('delete-account');
    if (error) {
      setBusy(false);
      setConfirmDelete(false);
      setMessage(error.message);
      return;
    }
    window.location.href = '/';
  }

  const rows: [keyof Settings, string, string][] = [
    ['strict_human_only', 'Strongly verified only', 'Hide content without strong origin evidence.'],
    ['include_awaiting_verification', 'Include awaiting verification', 'Allow work with process evidence that is still awaiting human review.'],
    ['hide_commercial', 'Hide commercial content', 'Reduce product and service promotion.'],
    ['show_local', 'Show local creators', 'Use your selected city or service area, never a private precise address.'],
  ];

  return (
    <div className="settings-grid">
      <section className="settings-panel settings-primary">
        <div className="panel-label">Content preferences</div>
        <div className="preference-list">
          {rows.map(([key, title, description]) => (
            <div className="preference-row" key={key}>
              <span className="preference-copy">
                <strong>{title}</strong>
                <span>{description}</span>
              </span>
              <ToggleSwitch
                on={settings[key]}
                label={title}
                onToggle={() => setSettings(current => ({
                  ...current,
                  [key]: !current[key],
                }))}
              />
            </div>
          ))}
        </div>
        <div className="actions">
          <button className="button primary" onClick={save} disabled={busy}>
            Save preferences
          </button>
        </div>
      </section>

      <section className="settings-panel">
        <div className="panel-label">Your data</div>
        <h3 className="panel-title">Export</h3>
        <p className="muted">Download the account information currently held by the platform.</p>
        <button className="button" onClick={exportData} disabled={busy}>Export my data</button>
      </section>

      <section className="settings-panel danger-zone">
        <div className="panel-label">Danger zone</div>
        <h3 className="panel-title">Delete account</h3>
        <p className="muted">Permanent deletion removes account access and owned data through the server-side deletion flow.</p>
        <button className="button danger" onClick={() => setConfirmDelete(true)} disabled={busy}>
          Delete permanently
        </button>
      </section>

      {message ? (
        <p className={message.includes('saved') ? 'settings-panel' : 'settings-panel notice'} role="status">
          {message}
        </p>
      ) : null}

      {confirmDelete ? (
        <div className="modal-backdrop" role="presentation">
          <section className="confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <div className="panel-label">Final confirmation</div>
            <h3 className="panel-title" id="delete-title">Delete this account?</h3>
            <p>This removes your Works, Collections, private evidence, and active sessions. This cannot be undone.</p>
            <div className="actions">
              <button className="button" type="button" onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button className="button danger-solid" type="button" onClick={deleteAccount} disabled={busy}>Delete account</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
