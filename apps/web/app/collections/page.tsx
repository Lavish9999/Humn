import { redirect } from 'next/navigation';
import { getServerSupabase } from '../../lib/supabase/server';
import { getCollectionsForOwner } from '../../lib/data/collections';
import type { CollectionSummary } from '../../lib/data/types';
import { CollectionsClient } from './collections-client';

export default async function CollectionsPage() {
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/signin?next=/collections');

  let collections: CollectionSummary[] = [];
  let loadError = '';
  try {
    collections = await getCollectionsForOwner(auth.user.id);
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'Collections could not load.';
  }

  return (
    <main className="shell section collections-page">
      <div className="section-head page-first-section">
        <div>
          <div className="eyebrow">Collections</div>
          <h1>Keep inspiration organized.</h1>
          <p className="section-intro">Build focused spaces for rooms, outfits, recipes, references, and works in progress.</p>
        </div>
      </div>
      {loadError ? <p className="field-error" role="alert">{loadError}</p> : null}
      <CollectionsClient initialCollections={collections} />
    </main>
  );
}
