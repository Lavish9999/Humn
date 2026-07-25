import Link from 'next/link';
import { getServerSupabase } from '../../lib/supabase/server';
import { MasonryFeed } from '../../components/masonry-feed';
import { devModeCatalogue, type CatalogueWork } from '../../lib/dev-catalogue';

export default async function DiscoverPage() {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.from('discover_works').select('*').limit(40);
  const works = (data?.length ? data : devModeCatalogue) as CatalogueWork[];
  return <main className="section">
    <div className="shell section-head"><div><div className="eyebrow">Discover / issue 001</div><h2>Made by people.</h2><p className="section-intro">A working index of images, objects, spaces, food, clothing, and process—each attached to a creator and an origin record.</p></div><Link className="button" href="/search">Refine feed</Link></div>
    {error && !works.length ? <div className="shell ruled-panel"><div className="panel-row" role="alert"><span className="meta">Load error</span><p>Discover could not load. Check Supabase configuration, then retry.</p></div></div> : !works.length ? <div className="shell editorial-empty"><span className="meta">Catalogue empty</span><p>Publish the first verified Work or run the development seed.</p></div> : <MasonryFeed works={works} />}
  </main>;
}
