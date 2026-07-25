import Image from 'next/image';
import { getServerSupabase } from '../../lib/supabase/server';
import { redirect } from 'next/navigation';
import { createCollectionSchema } from '@human/validation';
import { devModeCatalogue } from '../../lib/dev-catalogue';

async function createCollection(formData:FormData){'use server'; const parsed=createCollectionSchema.safeParse({name:formData.get('name'),privacy:formData.get('privacy')}); if(!parsed.success)return; const s=await getServerSupabase(); const {data:{user}}=await s.auth.getUser(); if(!user)redirect('/auth'); await s.from('collections').insert({...parsed.data,owner_id:user.id}); redirect('/collections');}

function updatedLabel(value:string){ const days=Math.max(0,Math.round((Date.now()-new Date(value).getTime())/86400000)); return days===0?'UPDATED TODAY':`UPDATED ${days}D AGO`; }
function CollectionMosaic({index}:{index:number}){ const catalogue=devModeCatalogue; if(!catalogue.length)return <div className="collection-mosaic collection-mosaic-empty"><span className="meta">Preview unavailable</span></div>; const works=[0,1,2,3].map(offset=>catalogue[(index*3+offset)%catalogue.length]); return <div className="collection-mosaic">{works.map(work=><div className="mosaic-cell" key={work.id}><Image src={work.media_url} alt="" width={work.width} height={work.height} unoptimized /></div>)}</div>; }

export default async function CollectionsPage(){ const s=await getServerSupabase(); const {data:{user}}=await s.auth.getUser(); if(!user)redirect('/auth'); const {data}=await s.from('collections').select('id,name,description,privacy,updated_at').order('updated_at',{ascending:false}); const collections=data??[]; const fillerCount=(3-((collections.length+1)%3))%3;
return <main className="shell section">
  <div className="section-head"><div><div className="eyebrow">Collections</div><h2>Keep inspiration organized.</h2><p className="section-intro">Build focused spaces for rooms, outfits, recipes, references, and works in progress.</p></div></div>
  <form id="new-collection" className="collection-create" action={createCollection}><label className="bare-field"><span className="field-label">Collection name</span><input name="name" required placeholder="Kitchen renovation" aria-label="Collection name"/></label><label className="select-field"><span className="field-label">Privacy</span><span className="select-wrap"><select name="privacy" defaultValue="private" aria-label="Privacy"><option value="private">Private</option><option value="invite_only">Invite-only</option><option value="public">Public</option></select></span></label><button className="collection-submit">Create</button></form>
  <div className="collection-grid collection-preview-grid">
    {collections.map((collection,index)=><article className="collection-card collection-preview-card" key={collection.id}><CollectionMosaic index={index}/><div className="collection-card-copy"><div className="meta">{collection.privacy.replace('_',' ')}</div><h3>{collection.name}</h3><p className="muted">{collection.description||'Save work that belongs together.'}</p><span className="meta">WORKS · {updatedLabel(collection.updated_at)}</span></div></article>)}
    {Array.from({length:fillerCount},(_,index)=><article className="collection-card collection-filler" aria-hidden="true" key={`filler-${index}`}><CollectionMosaic index={collections.length+index}/><div className="collection-card-copy"><div className="meta">Placeholder slot</div><h3>Next collection</h3><p className="muted">Reserved for another project space.</p></div></article>)}
    <a className="new-collection-card" href="#new-collection"><span aria-hidden="true">＋</span><strong>New collection</strong><span className="meta">Add another project space</span></a>
  </div>
</main>}
