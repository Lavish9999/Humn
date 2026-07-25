'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import type { CollectionSummary } from '../../lib/data/types';
import { pluralize } from '../../lib/pluralize';
import { relativeUpdatedLabel } from '../../lib/relative-time';
import { SelectChevron } from '../../components/select-chevron';
import { CollectionMosaic } from '../../components/collection-mosaic';

type ApiPayload = {
  collection?: CollectionSummary;
  error?: string;
  field?: string;
};

export function CollectionsClient({ initialCollections }: { initialCollections: CollectionSummary[] }) {
  const [collections, setCollections] = useState(initialCollections);
  const [name, setName] = useState('');
  const [privacy, setPrivacy] = useState<'private' | 'public'>('private');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const nameInput = useRef<HTMLInputElement | null>(null);

  async function createCollection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = name.trim();
    if (!normalized) {
      setError('Enter a collection name.');
      nameInput.current?.focus();
      return;
    }

    setBusy(true);
    setError('');
    const response = await fetch('/api/collections', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: normalized, privacy }),
    });
    const payload = await response.json().catch(() => ({})) as ApiPayload;

    if (!response.ok || !payload.collection) {
      setError(payload.error ?? 'The collection could not be created.');
      setBusy(false);
      return;
    }

    setCollections(current => [payload.collection!, ...current]);
    setName('');
    setPrivacy('private');
    setBusy(false);
  }

  return (
    <>
      <form id="new-collection" className="collection-create" onSubmit={createCollection}>
        <label className="bare-field">
          <span className="field-label">Collection name</span>
          <input ref={nameInput} name="name" required maxLength={100} value={name} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value)} placeholder="Kitchen renovation" aria-label="Collection name" />
          {error ? <span className="field-error collection-create-error" role="alert">{error}</span> : null}
        </label>
        <label className="select-field">
          <span className="field-label">Privacy</span>
          <span className="select-wrap">
            <select name="privacy" value={privacy} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setPrivacy(event.target.value as 'private' | 'public')} aria-label="Privacy">
              <option value="private">Private</option>
              <option value="public">Public</option>
            </select>
            <SelectChevron />
          </span>
        </label>
        <button className="collection-submit" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create'}</button>
      </form>

      <div className="collection-grid collection-preview-grid">
        {collections.map(collection => (
          <article className="collection-card collection-preview-card" key={collection.id}>
            <CollectionMosaic works={collection.preview_works} workCount={collection.work_count} />
            <Link className="collection-card-copy" href={`/collections/${collection.id}`}>
              <h3>{collection.name}</h3>
              <span className="meta">{pluralize(collection.work_count, 'WORK', 'WORKS')} · {relativeUpdatedLabel(collection.updated_at)}</span>
              <span className="meta">{collection.privacy}</span>
            </Link>
          </article>
        ))}
        <button className="new-collection-card" type="button" onClick={() => {
          nameInput.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          nameInput.current?.focus();
        }}>
          <span className="new-collection-mark" aria-hidden="true">＋</span>
          <strong className="new-collection-label">New collection</strong>
          <span className="meta">Create another project space</span>
        </button>
      </div>
    </>
  );
}
