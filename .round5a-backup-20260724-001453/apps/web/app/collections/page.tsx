import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createCollectionSchema } from '@human/validation';
import { getServerSupabase } from '../../lib/supabase/server';
import { devModeCatalogue } from '../../lib/dev-catalogue';
import { devModeCollections, type DevCollection } from '../../lib/dev-collections';
import { SelectChevron } from '../../components/select-chevron';

async function createCollection(formData: FormData) {
  'use server';
  const parsed = createCollectionSchema.safeParse({ name: formData.get('name'), privacy: formData.get('privacy') });
  if (!parsed.success) return;
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth');
  await supabase.from('collections').insert({ ...parsed.data, owner_id: user.id });
  redirect('/collections');
}

function updatedLabel(value: string) {
  const days = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 86400000));
  return days === 0 ? 'UPDATED TODAY' : `UPDATED ${days}D AGO`;
}

function CollectionMosaic({ workIds, index }: { workIds?: string[]; index: number }) {
  const requestedWorks = (workIds ?? [])
    .map(id => devModeCatalogue.find(work => work.id === id))
    .filter(Boolean);
  const fallbackWorks = Array.from({ length: 4 }, (_, offset) => devModeCatalogue[(index * 4 + offset) % devModeCatalogue.length]);
  const works = (requestedWorks.length ? requestedWorks : fallbackWorks).filter(Boolean).slice(0, 4);

  return (
    <div className="collection-mosaic">
      {works.map((work, cellIndex) => work ? (
        <Link className="mosaic-cell" href={`/work/${work.id}`} key={`${work.id}-${cellIndex}`} aria-label={`Open ${work.title}`}>
          <span className="media-skeleton" aria-hidden="true" />
          <Image src={work.media_url} alt={work.alt_text} width={work.width} height={work.height} unoptimized />
        </Link>
      ) : <span className="mosaic-cell" key={cellIndex} />)}
    </div>
  );
}

type CollectionRecord = {
  id: string;
  name: string;
  description: string | null;
  privacy: string;
  updated_at: string;
  collection_items?: Array<{ count: number }>;
  work_count?: number;
  work_ids?: string[];
  updated_label?: string;
  is_dev?: boolean;
};

export default async function CollectionsPage() {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth');
  const { data } = await supabase
    .from('collections')
    .select('id,name,description,privacy,updated_at,collection_items(count)')
    .order('updated_at', { ascending: false });

  const databaseCollections = (data ?? []) as CollectionRecord[];
  const databaseNames = new Set(databaseCollections.map(collection => collection.name.toLowerCase()));
  const collections: CollectionRecord[] = devModeCollections.length
    ? [...databaseCollections, ...(devModeCollections as DevCollection[]).filter(collection => !databaseNames.has(collection.name.toLowerCase()))]
    : databaseCollections;

  return (
    <main className="shell section collections-page">
      <div className="section-head page-first-section"><div><div className="eyebrow">Collections</div><h2>Keep inspiration organized.</h2><p className="section-intro">Build focused spaces for rooms, outfits, recipes, references, and works in progress.</p></div></div>
      <form id="new-collection" className="collection-create" action={createCollection}>
        <label className="bare-field"><span className="field-label">Collection name</span><input name="name" required placeholder="Kitchen renovation" aria-label="Collection name" /></label>
        <label className="select-field"><span className="field-label">Privacy</span><span className="select-wrap"><select name="privacy" defaultValue="private" aria-label="Privacy"><option value="private">Private</option><option value="invite_only">Invite-only</option><option value="public">Public</option></select><SelectChevron /></span></label>
        <button className="collection-submit">Create</button>
      </form>
      <div className="collection-grid collection-preview-grid">
        {collections.map((collection, index) => {
          const workCount = collection.work_count ?? Number(collection.collection_items?.[0]?.count ?? 0);
          const metaUpdated = collection.updated_label ?? updatedLabel(collection.updated_at);
          return (
            <article className="collection-card collection-preview-card" key={collection.id}>
              <CollectionMosaic index={index} workIds={collection.work_ids} />
              <div className="collection-card-copy"><h3>{collection.name}</h3><span className="meta">{workCount} WORKS · {metaUpdated}</span></div>
            </article>
          );
        })}
        <a className="new-collection-card" href="#new-collection"><span className="new-collection-mark" aria-hidden="true" /><strong>New collection</strong><span className="meta">Create another project space</span></a>
      </div>
    </main>
  );
}
