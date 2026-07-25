import Link from 'next/link';
import { productConfig } from '@human/config';

export default function HomePage() {
  return <main className="shell">
    <section className="hero">
      <div><div className="eyebrow">Human-made. Human-verified.</div><h1>Real inspiration exists.</h1>
      <p className="lede">Discover work made by people, inspect the evidence behind it, organize ideas into Collections, and support the creator who actually made it.</p>
      <div className="actions"><Link className="button" href="/discover">Explore Discover</Link><Link className="button secondary" href="/auth">Share your work</Link></div></div>
      <aside className="promise-card"><strong>{productConfig.tagline}</strong><div className="proof-list">
        {['Original files and capture evidence','Creation-process Proof Stories','Technical analysis without “perfect detector” claims','Creator reputation and human moderation'].map(x=><div className="proof-item" key={x}><span className="dot"/><span>{x}</span></div>)}
      </div></aside>
    </section>
  </main>;
}
