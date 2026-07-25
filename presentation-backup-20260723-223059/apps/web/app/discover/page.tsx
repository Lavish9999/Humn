import Image from 'next/image';
import Link from 'next/link';
import { getServerSupabase } from '../../lib/supabase/server';

export default async function DiscoverPage() {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.from('discover_works').select('*').limit(40);
  return <main className="shell section"><div className="section-head"><div><div className="eyebrow">Discover</div><h2>Made by people.</h2></div><Link className="button secondary" href="/search">Refine your feed</Link></div>
    {error ? <div className="empty" role="alert">Discover could not load. Check Supabase configuration, then retry.</div> : !data?.length ? <div className="empty"><strong>No published Works yet.</strong><p>Run the development seed or publish the first verified Work.</p></div> : <div className="masonry">{data.map((work:any)=><Link className="work-card" href={`/work/${work.id}`} key={work.id}>
      <Image className="work-media" src={work.media_url} alt={work.alt_text ?? work.title} width={work.width} height={work.height} sizes="(max-width: 700px) 50vw, 25vw" />
      <div className="work-meta"><div className="work-title">{work.title}</div><div className="creator-line"><span>@{work.creator_username}</span><span className="origin">{String(work.origin_status).replaceAll('_',' ')}</span></div></div>
    </Link>)}</div>}
  </main>;
}
