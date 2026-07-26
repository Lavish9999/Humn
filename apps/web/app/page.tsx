import Link from 'next/link';
import { getCategoryDisplayName, productConfig } from '@human/config';
import { MasonryFeed } from '../components/masonry-feed';
import { getWorkFeed } from '../lib/data/works';

const values = [
  ['01 / Discover', 'Find useful, beautiful work made by people across the categories you care about.'],
  ['02 / Save', 'Organize ideas into Collections for rooms, outfits, recipes, references, and future projects.'],
  ['03 / Process', 'Proof Stories show how a piece moved from first mark to final form.'],
  ['04 / Origin', 'Automated checks and recorded evidence support trust without pretending to prove authorship.'],
] as const;
const utilityIndex = [['14','Origin check passed','/discover?tier=verified'],['15','Following','/discover?view=following'],['16','Discover','/discover']] as const;

export default async function HomePage() {
  let works: Awaited<ReturnType<typeof getWorkFeed>>['items'] = [];

  try {
    const feed = await getWorkFeed({ limit: 8 });
    works = feed.items;
  } catch (error) {
    console.error('Homepage feed lookup failed.', error);
  }

  return <main className="home-page">
    <section className="shell hero page-first-section"><div className="hero-grid"><div><div className="eyebrow">Human-made / origin-recorded</div><h1>Discover what people make.</h1><p className="hero-copy">Find real inspiration, save ideas into Collections, follow the people behind the work, and explore the process attached to each piece.</p><div className="actions"><Link className="button primary" href="/discover">Explore Humn</Link><Link className="button" href="/share">Share your work</Link></div></div><aside className="hero-index" aria-label="Platform index"><div className="meta">Catalogue / 001</div><ul className="hero-index-list"><li><span>Format</span><span>Visual discovery</span></li><li><span>Focus</span><span>Work made by people</span></li><li><span>Context</span><span>Creator + process</span></li><li><span>Trust</span><span>Origin record, not certainty</span></li></ul></aside></div></section>
    <section className="value-grid" aria-label="How Humn works">{values.map(([kicker,copy])=><article className="value-item" key={kicker}><div className="section-kicker">{kicker}</div><p>{copy}</p></article>)}</section>
    <section className="home-feed-section"><div className="shell compact-section-head"><div><div className="eyebrow">Fresh from studios</div><h3>Recent work, with its creator and process attached.</h3></div></div>{works.length ? <MasonryFeed works={works} preview /> : <div className="shell editorial-empty"><span className="meta">Catalogue empty</span><p>The first published Works will appear here.</p></div>}<div className="shell preview-index-link"><Link className="text-link" href="/discover">Open full index</Link></div></section>
    <section className="shell category-section"><div className="category-heading"><div><div className="eyebrow">Browse the index</div><h3>Start with a medium, room, object, or practice.</h3></div><Link className="button" href="/discover">View all work</Link></div><div className="category-index">{productConfig.launchCategories.map((category,index)=><Link key={category} href={`/search?q=${encodeURIComponent(getCategoryDisplayName(category))}`}><span className="meta">{String(index+1).padStart(2,'0')}</span><span>{getCategoryDisplayName(category)}</span></Link>)}{utilityIndex.map(([number,label,href])=><Link key={label} href={href}><span className="meta">{number}</span><span>{label}</span></Link>)}</div></section>
  </main>;
}
