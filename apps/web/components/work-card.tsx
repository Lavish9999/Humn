'use client';

import Link from 'next/link';
import type { CollectionPickerCollection, WorkRecord } from '../lib/data/types';
import { FollowButton } from './follow-button';
import { ProvenanceBadge } from './provenance-badge';
import { SaveToCollectionButton } from './save-to-collection-button';

export function WorkCard({
  work,
  priority = false,
  isSignedIn = false,
  currentUserId = null,
  isFollowingCreator = false,
  collections = [],
  savedCollectionIds = [],
  removeControl,
}: {
  work: WorkRecord;
  priority?: boolean;
  isSignedIn?: boolean;
  currentUserId?: string | null;
  isFollowingCreator?: boolean;
  collections?: CollectionPickerCollection[];
  savedCollectionIds?: string[];
  removeControl?: { label?: string; onRemove: () => void; busy?: boolean };
}) {
  const ratio = `${work.width} / ${work.height}`;
  const isOwner = currentUserId === work.creator_id;
  return (
    <article className="work-card">
      <Link
        className="work-card-link"
        href={`/work/${work.id}`}
        aria-label={`Open ${work.title} by @${work.creator_username}`}
      >
        <div className="media-frame" style={{ aspectRatio: ratio }}>
          <span className="media-skeleton" aria-hidden="true" />
          <img
            className="work-media"
            src={work.media_url}
            alt={work.alt_text ?? work.title}
            width={work.width}
            height={work.height}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
          />
        </div>
      </Link>

      <div className="work-caption">
        <div className="work-card-creator-row">
          <Link className="creator-handle creator-profile-link" href={`/creator/${work.creator_username}`}>
            @{work.creator_username}
          </Link>
          <FollowButton
            creatorId={work.creator_id}
            handle={work.creator_username}
            isSignedIn={isSignedIn}
            isOwner={isOwner}
            initialFollowing={isFollowingCreator}
            compact
            nextPath={`/work/${work.id}`}
          />
        </div>
        <Link className="work-badge-link" href={`/work/${work.id}`} aria-label={`Open ${work.title}`}>
          <ProvenanceBadge variant={work.badge_variant} label={work.badge_label} />
        </Link>
      </div>

      <div className="work-card-controls">
        <SaveToCollectionButton
          workId={work.id}
          isSignedIn={isSignedIn}
          initialCollections={collections}
          initialSavedCollectionIds={savedCollectionIds}
          variant="card"
        />
        {removeControl ? (
          <button
            className="card-remove-button"
            type="button"
            onClick={removeControl.onRemove}
            disabled={removeControl.busy}
          >
            {removeControl.busy ? 'Removing…' : (removeControl.label ?? 'Remove')}
          </button>
        ) : null}
      </div>
    </article>
  );
}
