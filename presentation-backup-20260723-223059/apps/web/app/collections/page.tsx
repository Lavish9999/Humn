import { ArrowUpRight, Folder, Globe2, Lock, Plus, Users } from 'lucide-react';
import { redirect } from 'next/navigation';
import { createCollectionSchema } from '@human/validation';
import { getServerSupabase } from '../../lib/supabase/server';

async function createCollection(formData: FormData) {
  'use server';

  const parsed = createCollectionSchema.safeParse({
    name: formData.get('name'),
    privacy: formData.get('privacy'),
  });
  if (!parsed.success) return;

  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/auth');

  await supabase.from('collections').insert({
    ...parsed.data,
    owner_id: auth.user.id,
  });
  redirect('/collections');
}

function PrivacyIcon({ privacy }: { privacy: string }) {
  if (privacy === 'public') return <Globe2 size={14} />;
  if (privacy === 'invite_only') return <Users size={14} />;
  return <Lock size={14} />;
}

export default async function CollectionsPage() {
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/auth');

  const { data } = await supabase
    .from('collections')
    .select('id,name,description,privacy,updated_at')
    .order('updated_at', { ascending: false });

  return (
    <main className="shell section">
      <header className="page-header compact">
        <div className="page-kicker">Collections</div>
        <h1 className="page-title">Keep inspiration organized.</h1>
        <p className="page-subtitle">
          Build focused spaces for projects, outfits, rooms, recipes, and anything else you are planning.
        </p>
      </header>

      <form className="panel collection-create" action={createCollection}>
        <label className="input-group">
          <span className="input-label">Collection name</span>
          <input className="text-input" name="name" required placeholder="Kitchen renovation" />
        </label>
        <label className="input-group">
          <span className="input-label">Privacy</span>
          <select className="select-input" name="privacy" defaultValue="private">
            <option value="private">Private</option>
            <option value="invite_only">Invite-only</option>
            <option value="public">Public</option>
          </select>
        </label>
        <button className="button" type="submit">
          <Plus size={17} /> Create
        </button>
      </form>

      <section className="collection-grid" aria-label="Your Collections">
        {data?.length ? (
          data.map((collection) => (
            <article className="collection-card" key={collection.id}>
              <div className="collection-card-top">
                <span className="collection-icon" aria-hidden="true"><Folder size={20} /></span>
                <ArrowUpRight className="collection-arrow" size={18} aria-hidden="true" />
              </div>
              <h2 className="collection-name">{collection.name}</h2>
              <p className="collection-description">
                {collection.description || 'Save work that belongs together.'}
              </p>
              <footer className="collection-footer">
                <span className="privacy-chip">
                  <PrivacyIcon privacy={collection.privacy} />
                  {collection.privacy.replace('_', ' ')}
                </span>
              </footer>
            </article>
          ))
        ) : (
          <div className="empty empty-collections">
            <Folder size={26} aria-hidden="true" />
            <h2>No Collections yet</h2>
            <p>Create one above, then save Works that belong together.</p>
          </div>
        )}
      </section>
    </main>
  );
}
