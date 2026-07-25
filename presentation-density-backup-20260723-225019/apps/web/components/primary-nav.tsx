'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  ['/discover', 'Discover'],
  ['/search', 'Search'],
  ['/collections', 'Collections'],
  ['/settings', 'You'],
] as const;

export function PrimaryNav() {
  const pathname = usePathname();
  return <nav className="nav" aria-label="Primary">
    {links.map(([href, label]) => <Link key={href} className="nav-link" href={href} aria-current={pathname.startsWith(href) ? 'page' : undefined}>{label}</Link>)}
    <Link className="nav-link nav-auth" href="/auth" aria-current={pathname.startsWith('/auth') ? 'page' : undefined}>Sign in</Link>
  </nav>;
}
