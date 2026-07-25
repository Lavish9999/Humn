import Link from 'next/link';
import { getServerSupabase } from '../../lib/supabase/server';

const examples = ['botanical tattoo', 'walnut table', 'braided hair', 'small kitchen', 'ceramic mug', 'linen outfit', 'film portrait', 'garden path'];

export default async function SearchPage({searchParams}:{searchParams:Promise<{q?:string}>}){
  const {q=''}=await searchParams; const supabase=await getServerSupabase(); let data:any[]=[];
  if(q.trim()){ const result=await supabase.rpc('search_works',{search_query:q.trim(),result_limit:40}); data=result.data??[]; }
  return <main className="shell section">
    <div className="section-head"><div><div className="eyebrow">Index search</div><h2>Search human-made work.</h2></div></div>
    <form className="search-form"><input className="search-input" name="q" defaultValue={q} placeholder="Tattoo style, walnut table, braided hair…" aria-label="Search Works"/><button className="search-submit">Go</button></form>
    {!q ? <div className="search-suggestions"><span className="meta">Try:</span>{examples.map(example=><Link key={example} href={`/search?q=${encodeURIComponent(example)}`}>{example}</Link>)}</div> : !data.length ? <div className="search-suggestions"><span className="meta">No match:</span><span>Try a broader phrase or one of the examples above.</span></div> : <div className="search-results">{data.map(x=><Link key={x.id} className="search-result" href={`/work/${x.id}`}><div><div className="work-title">{x.title}</div><div className="muted">@{x.creator_username}</div></div><span className="badge">{String(x.origin_status).replaceAll('_',' ')}</span></Link>)}</div>}
  </main>;
}
