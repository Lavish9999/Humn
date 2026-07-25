'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CollectionDetail, CollectionSaveContext, WorkRecord } from '../../../lib/data/types';
import type { FollowContext } from '../../../lib/data/follows';
import { pluralize } from '../../../lib/pluralize';
import { relativeUpdatedLabel } from '../../../lib/relative-time';
import { SelectChevron } from '../../../components/select-chevron';
import { WorkCard } from '../../../components/work-card';

type Props = {
  initialCollection: CollectionDetail;
  saveContext: CollectionSaveContext;
  followContext: FollowContext;
};

export function CollectionDetailClient({ initialCollection, saveContext, followContext }: Props) {
  const [name, setName] = useState(initialCollection.name);
  const [privacy, setPrivacy] = useState(initialCollection.privacy);
  const [updatedAt, setUpdatedAt] = useState(initialCollection.updated_at);
  const [works, setWorks] = useState<WorkRecord[]>(initialCollection.works);
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const router = useRouter();

  async function saveCollectionSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setStatus('');
    const response = await fetch(`/api/collections/${initialCollection.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, privacy }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? 'The collection could not be updated.');
      setBusy(false);
      return;
    }
    setStatus('COLLECTION UPDATED');
    setUpdatedAt(new Date().toISOString());
    setBusy(false);
    router.refresh();
  }

  async function removeWork(workId: string) {
    if (removingId) return;
    const previous = works;
    setRemovingId(workId);
    setWorks(current => current.filter(work => work.id !== workId));
    setError('');
    setStatus('WORK REMOVED FROM COLLECTION');
    setUpdatedAt(new Date().toISOString());

    const response = await fetch(`/api/collections/${initialCollection.id}/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workId, action: 'remove' }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      setWorks(previous);
      setError(payload.error ?? 'The Work could not be removed.');
      setStatus('');
    }
    setRemovingId(null);
  }

  async function deleteCollection() {
    setBusy(true);
    setError('');
    const response = await fetch(`/api/collections/${initialCollection.id}`, { method: 'DELETE' });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? 'The collection could not be deleted.');
      setBusy(false);
      setConfirmDelete(false);
      return;
    }
    router.push('/collections');
    router.refresh();
  }

  return (
    <main className="section collection-detail-page">
      <header className="shell collection-detail-head page-first-section">
        <div>
          <div className="eyebrow">Collection / {privacy}</div>
          <h1>{name}</h1>
          <p className="section-intro">
            Curated by <Link className="creator-profile-link" href={`/creator/${initialCollection.owner.handle}`}><strong>@{initialCollection.owner.handle}</strong></Link> · {pluralize(works.length, 'WORK', 'WORKS')} · {relativeUpdatedLabel(updatedAt)}
          </p>
        </div>
      </header>

      {initialCollection.is_owner ? (
        <section className="shell collection-owner-panel" aria-label="Collection settings">
          <form className="collection-owner-form" onSubmit={saveCollectionSettings}>
            <label className="bare-field">
              <span className="field-label">Name</span>
              <input value={name} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value)} maxLength={100} required />
            </label>
            <label className="select-field">
              <span className="field-label">Privacy</span>
              <span className="select-wrap">
                <select value={privacy} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setPrivacy(event.target.value as 'private' | 'public')}>
                  <option value="private">Private</option>
                  <option value="public">Public</option>
                </select>
                <SelectChevron />
              </span>
            </label>
            <button className="collection-submit" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
          </form>
          <button className="danger-button collection-delete-trigger" type="button" onClick={() => setConfirmDelete(true)}>Delete collection</button>
          {status ? <p className="meta" role="status">{status}</p> : null}
          {error ? <p className="field-error" role="alert">{error}</p> : null}
        </section>
      ) : null}

      {works.length ? (
        <div className="shell masonry-shell collection-detail-feed">
          <div className="masonry">
            {works.map((work, index) => (
              <WorkCard
                key={work.id}
                work={work}
                priority={index < 3}
                isSignedIn={followContext.isSignedIn || saveContext.isSignedIn}
                currentUserId={followContext.currentUserId}
                isFollowingCreator={followContext.followingCreatorIds.includes(work.creator_id)}
                collections={saveContext.collections}
                savedCollectionIds={saveContext.savedByWork[work.id] ?? []}
                {...(initialCollection.is_owner ? {
                  removeControl: {
                    label: 'Remove from collection',
                    busy: removingId === work.id,
                    onRemove: () => removeWork(work.id),
                  },
                } : {})}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="shell editorial-empty collection-detail-empty">
          <span className="meta">Collection empty</span>
          <p>Saved Works will appear here without changing or deleting the original Work.</p>
        </div>
      )}

      {confirmDelete ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event: React.MouseEvent<HTMLDivElement>) => {
          if (event.currentTarget === event.target) setConfirmDelete(false);
        }}>
          <section className="confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="delete-collection-title">
            <div className="panel-label">Danger zone</div>
            <h2 className="dialog-title" id="delete-collection-title">Delete “{name}”?</h2>
            <p>This removes the collection and its saved-item links. The Works themselves are never deleted.</p>
            <div className="actions">
              <button className="danger-button danger-button-solid" type="button" onClick={deleteCollection} disabled={busy}>{busy ? 'Deleting…' : 'Delete permanently'}</button>
              <button className="button" type="button" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
