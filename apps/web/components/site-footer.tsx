import Link from 'next/link';
import { productConfig } from '@human/config';

const columns = [
  ['About', [['What Humn is', '/about'], ['Discover', '/discover'], ['Search', '/search']]],
  ['For creators', [['Share your work', '/share'], ['Collections', '/collections'], ['Private account', '/account']]],
  ['Provenance & method', [['How verification works', '/method/origin-status'], ['Proof records', '/method/proof-records'], ['Moderation standard', '/method/moderation-standard']]],
  ['Legal', [['Privacy', '/privacy'], ['Terms', '/terms'], ['Copyright', '/copyright']]],
] as const;

export function SiteFooter() {
  return <footer className="site-footer" aria-label="Site footer">
    <nav className="shell footer-grid" aria-label="Footer navigation">
      {columns.map(([heading, links]) => <section className="footer-column" key={heading}>
        <div className="meta">{heading}</div>
        <div className="footer-links">{links.map(([label, href]) => <Link href={href} key={label}>{label}</Link>)}</div>
      </section>)}
    </nav>
    <div className="footer-bottom"><div className="shell footer-bottom-inner"><span className="footer-wordmark">{productConfig.name}</span><p>Verification reflects available origin evidence and automated review; it is never presented as an absolute guarantee.</p></div></div>
  </footer>;
}
