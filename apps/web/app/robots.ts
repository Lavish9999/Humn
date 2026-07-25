import type { MetadataRoute } from 'next';
import { getSiteOrigin, isProductionDeployment } from '../lib/deployment/site-url';

export default function robots(): MetadataRoute.Robots {
  if (!isProductionDeployment()) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${getSiteOrigin()}/sitemap.xml`,
  };
}
