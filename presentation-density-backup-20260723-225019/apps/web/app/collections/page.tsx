import { getServerSupabase } from '../../lib/supabase/server';
import { redirect } from 'next/navigation';
import { createCollectionSchema } from '@human/validation';

async function createCollection(formData:FormData){'use server'; const parsed=createCollectionSchema.safeParse({name:formData.get('name'),privacy:formData.get('privacy')}); if(!parsed.success)return; const s=await getServerSupabase(); const {data:{user}}=await s.auth.getUser(); if(!user)redirect('/auth'); await s.from('collections').insert({...parsed.data,owner_id:user.id}); redirect('/collections');}

export default async function CollectionsPage(){ const s=await getServerSupabase(); const {data:{user}}=await s.auth.getUser(); if(!user)redirect('/auth'); const {data}=await s.from('collections').select('id,name,description,privacy,updated_at').order('updated_at',{ascending:false});
return <main className="shell section">
  <div className="section-head"><div><div className="eyebrow">Collections</div><h2>Keep inspiration organized.</h2><p className="section-intro">Build focused spaces for rooms, outfits, recipes, references, and works in progress.</p></div></div>
  <form className="collection-create" action={createCollection}><input name="name" required placeholder="Collection name" aria-label="Collection name"/><select name="privacy" defaultValue="private" aria-label="Privacy"><option value="private">Private</option><option value="invite_only">Invite-only</option><option value="public">Public</option></select><button>Create</button></form>
  {data?.length ? <div className="collection-grid">{data.map(c=><article className="collection-card" key={c.id}><div><div className="meta">{c.privacy.replace('_',' ')}</div><h3>{c.name}</h3><p className="muted">{c.description||'Save work that belongs together.'}</p></div><span className="meta">Updated {new Date(c.updated_at).toLocaleDateString()}</span></article>)}</div> : <div className="empty-grid"><div className="empty-tile"><span className="meta">Collection / 001</span><strong>Kitchen renovation</strong></div><div className="empty-tile"><span className="meta">Collection / 002</span><strong>Sleeve references</strong></div><div className="empty-tile"><span className="meta">Collection / 003</span><strong>Weekly recipes</strong></div></div>}
</main>}
