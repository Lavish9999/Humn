import Link from 'next/link';
import { getServerSupabase } from '../../lib/supabase/server';
import { MasonryFeed } from '../../components/masonry-feed';
import { ProvenanceBadge } from '../../components/provenance-badge';
import { devModeCatalogue } from '../../lib/dev-catalogue';

const examples = ['botanical tattoo', 'walnut table', 'braided hair', 'small kitchen', 'ceramic mug', 'linen outfit', 'film portrait', 'garden path'];
const adjacent = ['botanical linework', 'healed sleeve', 'oak joinery', 'braid pattern', 'compact kitchen', 'studio pottery'];

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const supabase = await getServerSupabase();
  let data: any[] = [];
  if (q.trim()) {
    const result = await supabase.rpc('search_works', { search_query: q.trim(), result_limit: 40 });
    data = result.data ?? [];
  }

  return (
    <main className="section">
      <div className="shell section-head">
        <div><div className="eyebrow">Index search</div><h2>Search human-made work.</h2></div>
      </div>
      <div className="shell">
        <form className="search-form">
          <input className="search-input" name="q" defaultValue={q} placeholder="Tattoo style, walnut table, braided hair…" aria-label="Search Works" />
          <button className="search-submit">Search</button>
        </form>
        {!q ? (
          <div className="search-suggestions"><span className="meta">Try:</span>{examples.map(example => <Link key={example} href={`/search?q=${encodeURIComponent(example)}`}>{example}</Link>)}</div>
        ) : !data.length ? (
          <div className="search-suggestions search-empty"><span className="meta">No exact match:</span>{adjacent.map(example => <Link key={example} href={`/search?q=${encodeURIComponent(example)}`}>{example}</Link>)}</div>
        ) : (
          <div className="search-results">
            {data.map(work => (
              <Link key={work.id} className="search-result" href={`/work/${work.id}`}>
                <div><div className="work-title">{work.title}</div><div className="muted">@{work.creator_username}</div></div>
                <ProvenanceBadge status={work.origin_status} proofCount={work.proof_count ?? 0} />
              </Link>
            ))}
          </div>
        )}
      </div>
      {!q && <section className="search-browse"><div className="shell compact-section-head"><div><div className="eyebrow">Trending now</div><h3>Browse before you search.</h3></div></div><MasonryFeed works={devModeCatalogue} /></section>}
    </main>
  );
}
