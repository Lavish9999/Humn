import Link from 'next/link';
import { getCategoryDisplayName, productConfig } from '@human/config';
import { MasonryFeed } from '../components/masonry-feed';
import { getWorkFeed } from '../lib/data/works';

const values = [
  ['01 / Origin', 'Original files and capture evidence stay attached to the work.'],
  ['02 / Process', 'Proof Stories show how a piece moved from first mark to final form.'],
  ['03 / Review', 'Technical signals inform review without pretending detection is perfect.'],
  ['04 / Credit', 'Creator attribution and human moderation remain part of every decision.'],
] as const;
const utilityIndex = [['14','Strongly Verified','/discover?tier=verified'],['15','Following','/discover?view=following'],['16','Discover','/discover']] as const;

export default async function HomePage() {
  const { items: works } = await getWorkFeed({ limit: 8 });
  return <main className="home-page">
    <section className="shell hero page-first-section"><div className="hero-grid"><div><div className="eyebrow">Human-made / human-verified</div><h1>Real inspiration exists.</h1><p className="hero-copy">Discover work made by people, inspect the evidence behind it, organize ideas into Collections, and support the creator who actually made it.</p><div className="actions"><Link className="button primary" href="/discover">Explore discover</Link><Link className="button" href="/share">Share your work</Link></div></div><aside className="hero-index" aria-label="Platform index"><div className="meta">Catalogue / 001</div><ul className="hero-index-list"><li><span>Format</span><span>Visual discovery</span></li><li><span>Focus</span><span>Human-created work</span></li><li><span>Evidence</span><span>Origin + process</span></li><li><span>Standard</span><span>Credible, not absolute</span></li></ul></aside></div></section>
    <section className="value-grid" aria-label="How verification works">{values.map(([kicker,copy])=><article className="value-item" key={kicker}><div className="section-kicker">{kicker}</div><p>{copy}</p></article>)}</section>
    <section className="home-feed-section"><div className="shell compact-section-head"><div><div className="eyebrow">Fresh from studios</div><h3>Recent work, with its origin record.</h3></div></div>{works.length ? <MasonryFeed works={works} preview /> : <div className="shell editorial-empty"><span className="meta">Catalogue empty</span><p>The first published Works will appear here.</p></div>}<div className="shell preview-index-link"><Link className="text-link" href="/discover">Open full index</Link></div></section>
    <section className="shell category-section"><div className="category-heading"><div><div className="eyebrow">Browse the index</div><h3>Start with a medium, room, object, or practice.</h3></div><Link className="button" href="/discover">View all work</Link></div><div className="category-index">{productConfig.launchCategories.map((category,index)=><Link key={category} href={`/search?q=${encodeURIComponent(getCategoryDisplayName(category))}`}><span className="meta">{String(index+1).padStart(2,'0')}</span><span>{getCategoryDisplayName(category)}</span></Link>)}{utilityIndex.map(([number,label,href])=><Link key={label} href={href}><span className="meta">{number}</span><span>{label}</span></Link>)}</div></section>
  </main>;
}
