import type { Metadata } from 'next';
import Link from 'next/link';
import { Fraunces, Inter_Tight, JetBrains_Mono } from 'next/font/google';
import { productConfig } from '@human/config';
import { PrimaryNav } from '../components/primary-nav';
import './globals.css';

const display = Fraunces({ subsets: ['latin'], weight: ['600'], variable: '--font-display', display: 'swap' });
const body = Inter_Tight({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-body', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = { title: productConfig.name, description: productConfig.description };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${display.variable} ${body.variable} ${mono.variable}`}>
    <header className="topbar"><div className="shell topbar-inner">
      <Link className="brand" href="/">{productConfig.name}</Link>
      <PrimaryNav />
    </div></header>
    {children}
  </body></html>;
}
