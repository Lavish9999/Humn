import Image from 'next/image';
import { redirect } from 'next/navigation';
import { createCollectionSchema } from '@human/validation';
import { getServerSupabase } from '../../lib/supabase/server';
import { devModeCatalogue } from '../../lib/dev-catalogue';

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

function CollectionMosaic({ index, workCount }: { index: number; workCount: number }) {
  if (!devModeCatalogue.length) {
    return <div className="collection-mosaic collection-mosaic-empty" aria-hidden="true">{[0, 1, 2, 3].map(cell => <span className="mosaic-cell" key={cell} />)}</div>;
  }

  const visibleCount = workCount > 0 ? Math.min(4, workCount) : 4;
  const works = Array.from({ length: visibleCount }, (_, offset) => devModeCatalogue[(index * 3 + offset) % devModeCatalogue.length]!);
  return <div className={`collection-mosaic mosaic-count-${visibleCount}`}>
    {works.map((work, cellIndex) => <div className="mosaic-cell" key={`${work.id}-${cellIndex}`}><Image src={work.media_url} alt="" width={work.width} height={work.height} unoptimized /></div>)}
    {workCount > 4 && <span className="mosaic-more">+{workCount - 4}</span>}
  </div>;
}

type CollectionRecord = {
  id: string;
  name: string;
  description: string | null;
  privacy: string;
  updated_at: string;
  collection_items?: Array<{ count: number }>;
};

export default async function CollectionsPage() {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth');
  const { data } = await supabase
    .from('collections')
    .select('id,name,description,privacy,updated_at,collection_items(count)')
    .order('updated_at', { ascending: false });
  const collections = (data ?? []) as CollectionRecord[];

  return <main className="shell section">
    <div className="section-head"><div><div className="eyebrow">Collections</div><h2>Keep inspiration organized.</h2><p className="section-intro">Build focused spaces for rooms, outfits, recipes, references, and works in progress.</p></div></div>
    <form id="new-collection" className="collection-create" action={createCollection}><label className="bare-field"><span className="field-label">Collection name</span><input name="name" required placeholder="Kitchen renovation" aria-label="Collection name" /></label><label className="select-field"><span className="field-label">Privacy</span><span className="select-wrap"><select name="privacy" defaultValue="private" aria-label="Privacy"><option value="private">Private</option><option value="invite_only">Invite-only</option><option value="public">Public</option></select></span></label><button className="collection-submit">Create</button></form>
    <div className="collection-grid collection-preview-grid">
      {collections.map((collection, index) => {
        const workCount = Number(collection.collection_items?.[0]?.count ?? 0);
        return <article className="collection-card collection-preview-card" key={collection.id}>
          <CollectionMosaic index={index} workCount={workCount} />
          <div className="collection-card-copy"><h3>{collection.name}</h3><span className="meta">{workCount} WORKS · {updatedLabel(collection.updated_at)}</span></div>
        </article>;
      })}
      <a className="new-collection-card" href="#new-collection"><span className="new-collection-mark" aria-hidden="true">＋</span><strong>New collection</strong><span className="meta">Create another project space</span></a>
    </div>
  </main>;
}
