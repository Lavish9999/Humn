import type { Metadata } from 'next';
import Link from 'next/link';
import { productConfig } from '@human/config';
import './globals.css';

export const metadata: Metadata = {
  title: productConfig.name,
  description: productConfig.description,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="shell topbar-inner">
            <Link className="brand" href="/">{productConfig.name}</Link>
            <nav className="nav" aria-label="Primary">
              <Link href="/discover">Discover</Link>
              <Link href="/search">Search</Link>
              <Link href="/collections">Collections</Link>
              <Link href="/settings">You</Link>
              <Link href="/auth" className="nav-signin">Sign in</Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
