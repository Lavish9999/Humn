import Link from 'next/link';
import { getServerSupabase } from '../../lib/supabase/server';
export default async function SearchPage({searchParams}:{searchParams:Promise<{q?:string}>}){
  const {q=''}=await searchParams; const supabase=await getServerSupabase(); let data:any[]=[];
  if(q.trim()){ const result=await supabase.rpc('search_works',{search_query:q.trim(),result_limit:40}); data=result.data??[]; }
  return <main className="shell section"><h2>Search human-made work</h2><form className="actions"><input name="q" defaultValue={q} placeholder="Tattoo style, walnut table, braided hair…" style={{flex:1,padding:14,border:'1px solid var(--border)',borderRadius:12}}/><button className="button">Search</button></form>
  {!q?<div className="empty" style={{marginTop:24}}>Search Works, creators, styles, materials, locations, recipes, and services.</div>:!data.length?<div className="empty" style={{marginTop:24}}>No matching Works. Try a broader phrase.</div>:<div style={{display:'grid',gap:12,marginTop:24}}>{data.map(x=><Link key={x.id} className="promise-card" href={`/work/${x.id}`}><strong>{x.title}</strong><div style={{color:'var(--muted)'}}>@{x.creator_username} · {x.origin_status}</div></Link>)}</div>}
  </main>;
}
