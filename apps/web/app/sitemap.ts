import type { MetadataRoute } from 'next';
import { getSiteOrigin } from '../lib/deployment/site-url';

const publicRoutes = [
  '',
  '/discover',
  '/search',
  '/about',
  '/privacy',
  '/terms',
  '/copyright',
  '/method/origin-status',
  '/method/proof-records',
  '/method/moderation-standard',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getSiteOrigin();
  return publicRoutes.map((path) => ({
    url: `${origin}${path}`,
    changeFrequency: path === '' || path === '/discover' ? 'daily' : 'monthly',
    priority: path === '' ? 1 : path === '/discover' ? 0.9 : 0.6,
  }));
}
