'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { CollectionPickerCollection } from '../lib/data/types';
import { SelectChevron } from './select-chevron';

type Props = {
  workId: string;
  isSignedIn: boolean;
  initialCollections: CollectionPickerCollection[];
  initialSavedCollectionIds: string[];
  variant?: 'card' | 'detail';
};

type ApiError = { error?: string; field?: string };

export function SaveToCollectionButton({
  workId,
  isSignedIn,
  initialCollections,
  initialSavedCollectionIds,
  variant = 'card',
}: Props) {
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState(initialCollections);
  const [savedIds, setSavedIds] = useState(() => new Set(initialSavedCollectionIds));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrivacy, setNewPrivacy] = useState<'private' | 'public'>('private');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const firstInput = useRef<HTMLInputElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const savedCount = savedIds.size;
  const buttonLabel = useMemo(() => {
    if (!isSignedIn) return variant === 'detail' ? 'Sign in to Save' : 'Save';
    if (savedCount > 0) return variant === 'detail' ? `Saved to ${savedCount}` : 'Saved';
    return variant === 'detail' ? 'Save to Collection' : 'Save';
  }, [isSignedIn, savedCount, variant]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (showNew) firstInput.current?.focus();
  }, [showNew]);

  function openPicker() {
    if (!isSignedIn) {
      router.push(`/signin?next=${encodeURIComponent(pathname || `/work/${workId}`)}`);
      return;
    }
    setError('');
    setMessage('');
    setOpen(true);
  }

  async function toggleCollection(collectionId: string) {
    if (busyId) return;
    const wasSaved = savedIds.has(collectionId);
    const next = new Set(savedIds);
    if (wasSaved) next.delete(collectionId); else next.add(collectionId);
    setSavedIds(next);
    setBusyId(collectionId);
    setError('');
    setMessage(wasSaved ? 'REMOVED FROM COLLECTION' : 'SAVED TO COLLECTION');

    const response = await fetch(`/api/collections/${collectionId}/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workId, action: wasSaved ? 'remove' : 'save' }),
    });

    if (!response.ok) {
      setSavedIds(savedIds);
      const payload = await response.json().catch(() => ({})) as ApiError;
      setError(payload.error ?? 'The collection could not be updated.');
      setMessage('');
      if (response.status === 401) router.push(`/signin?next=${encodeURIComponent(pathname)}`);
    }
    setBusyId(null);
  }

  async function createAndSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) {
      setError('Enter a collection name.');
      return;
    }

    setCreating(true);
    setError('');
    setMessage('');
    const response = await fetch('/api/collections', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, privacy: newPrivacy, workId }),
    });
    const payload = await response.json().catch(() => ({})) as ApiError & {
      collection?: CollectionPickerCollection;
      saved?: boolean;
    };

    if (!response.ok || !payload.collection) {
      setError(payload.error ?? 'The collection could not be created.');
      if (response.status === 401) router.push(`/signin?next=${encodeURIComponent(pathname)}`);
      setCreating(false);
      return;
    }

    setCollections(current => [payload.collection!, ...current]);
    setSavedIds(current => new Set(current).add(payload.collection!.id));
    setNewName('');
    setNewPrivacy('private');
    setShowNew(false);
    setMessage('COLLECTION CREATED · WORK SAVED');
    setCreating(false);
  }

  return (
    <div className={variant === 'card' ? 'save-control save-control-card' : 'save-control'}>
      <button
        className={variant === 'card' ? 'card-save-button' : 'button'}
        type="button"
        onClick={openPicker}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {buttonLabel}
      </button>

      {open ? (
        <div className="collection-picker-backdrop" role="presentation" onMouseDown={(event: React.MouseEvent<HTMLDivElement>) => {
          if (event.currentTarget === event.target) setOpen(false);
        }}>
          <section className="collection-picker" role="dialog" aria-modal="true" aria-labelledby={`save-title-${workId}`}>
            <header className="collection-picker-head">
              <div>
                <div className="meta">Save work</div>
                <h2 id={`save-title-${workId}`}>Choose a collection.</h2>
              </div>
              <button className="button collection-picker-close" type="button" onClick={() => setOpen(false)}>Close</button>
            </header>

            <div className="collection-picker-list">
              {collections.map(collection => {
                const saved = savedIds.has(collection.id);
                return (
                  <button
                    className="collection-picker-row"
                    type="button"
                    key={collection.id}
                    data-saved={saved}
                    onClick={() => toggleCollection(collection.id)}
                    disabled={busyId === collection.id}
                  >
                    <span>
                      <strong>{collection.name}</strong>
                      <span className="meta">{collection.privacy}</span>
                    </span>
                    <span className="meta">{saved ? 'SAVED · REMOVE' : 'SAVE'}</span>
                  </button>
                );
              })}
              {!collections.length && !showNew ? (
                <div className="collection-picker-empty">
                  <span className="meta">No collections yet</span>
                  <p>Create the first one and this Work will be saved into it.</p>
                </div>
              ) : null}
            </div>

            {!showNew ? (
              <button className="new-collection-inline" type="button" onClick={() => setShowNew(true)}>
                <span aria-hidden="true">＋</span> New collection
              </button>
            ) : (
              <form className="collection-picker-create" onSubmit={createAndSave}>
                <label className="field">
                  <span className="field-label">Collection name</span>
                  <input ref={firstInput} value={newName} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setNewName(event.target.value)} maxLength={100} required />
                </label>
                <label className="field">
                  <span className="field-label">Privacy</span>
                  <span className="select-wrap">
                    <select value={newPrivacy} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setNewPrivacy(event.target.value as 'private' | 'public')}>
                      <option value="private">Private</option>
                      <option value="public">Public</option>
                    </select>
                    <SelectChevron />
                  </span>
                </label>
                <div className="actions">
                  <button className="button primary" type="submit" disabled={creating}>{creating ? 'Creating…' : 'Create + Save'}</button>
                  <button className="button" type="button" onClick={() => setShowNew(false)}>Cancel</button>
                </div>
              </form>
            )}

            {message ? <p className="meta collection-picker-status" role="status">{message}</p> : null}
            {error ? <p className="field-error collection-picker-status" role="alert">{error}</p> : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
