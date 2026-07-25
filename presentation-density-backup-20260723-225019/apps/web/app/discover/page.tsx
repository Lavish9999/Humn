import Image from 'next/image';
import Link from 'next/link';
import { getServerSupabase } from '../../lib/supabase/server';

export default async function DiscoverPage() {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.from('discover_works').select('*').limit(40);
  return <main className="shell section">
    <div className="section-head"><div><div className="eyebrow">Discover / issue 001</div><h2>Made by people.</h2><p className="section-intro">A working index of images, objects, spaces, food, clothing, and process—each attached to a creator and an origin record.</p></div><Link className="button" href="/search">Refine feed</Link></div>
    {error ? <div className="ruled-panel"><div className="panel-row" role="alert"><span className="meta">Load error</span><p>Discover could not load. Check Supabase configuration, then retry.</p></div></div> : !data?.length ? <div className="empty-grid"><div className="empty-tile"><span className="meta">Work / 001</span><strong>Publish the first verified Work.</strong></div><div className="empty-tile"><span className="meta">Work / 002</span><strong>Run the development seed.</strong></div><div className="empty-tile"><span className="meta">Work / 003</span><strong>Return when the catalogue has entries.</strong></div></div> : <div className="masonry">{data.map((work:any)=><Link className="work-card" href={`/work/${work.id}`} key={work.id}>
      <Image className="work-media" src={work.media_url} alt={work.alt_text ?? work.title} width={work.width} height={work.height} sizes="(max-width: 700px) 50vw, 25vw" />
      <div className="work-meta"><div className="work-title">{work.title}</div><div className="creator-line"><span>@{work.creator_username}</span><span className="badge">{String(work.origin_status).replaceAll('_',' ')}</span></div></div>
    </Link>)}</div>}
  </main>;
}
