import type { NextConfig } from 'next';
const config: NextConfig = {
  transpilePackages: ['@human/config', '@human/database', '@human/design-tokens', '@human/validation'],
  serverExternalPackages: ['sharp', 'exifr', '@contentauth/c2pa-node'],
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
};
export default config;
