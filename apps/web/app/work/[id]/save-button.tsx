'use client';

import { useState } from 'react';
import type { CollectionPickerCollection } from '../../../lib/data/types';
import { SaveToCollectionButton } from '../../../components/save-to-collection-button';

export function WorkActionButtons({
  workId,
  title,
  creatorUsername,
  isSignedIn,
  collections,
  savedCollectionIds,
}: {
  workId: string;
  title: string;
  creatorUsername: string;
  isDevelopment?: boolean;
  isSignedIn: boolean;
  collections: CollectionPickerCollection[];
  savedCollectionIds: string[];
}) {
  const [status, setStatus] = useState('');

  async function share() {
    const url = window.location.href;
    setStatus('');
    try {
      if (navigator.share) {
        await navigator.share({ title, text: `${title} by @${creatorUsername}`, url });
        setStatus('SHARED');
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setStatus('LINK COPIED');
        return;
      }
      window.prompt('Copy this link:', url);
      setStatus('SHARE LINK READY');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setStatus('SHARE CANCELLED');
        return;
      }
      window.prompt('Copy this link:', url);
      setStatus('SHARE LINK READY');
    }
  }

  return (
    <div className="work-actions-wrap">
      <div className="actions work-actions">
        <SaveToCollectionButton
          workId={workId}
          isSignedIn={isSignedIn}
          initialCollections={collections}
          initialSavedCollectionIds={savedCollectionIds}
          variant="detail"
        />
        <button className="button" type="button" onClick={share}>Share</button>
      </div>
      {status ? <p className="meta work-action-status" role="status">{status}</p> : null}
    </div>
  );
}
