export const productConfig = {
  name: 'Humn',
  tagline: 'Real inspiration, made by real people.',
  description: 'The trusted discovery platform for human-created work.',
  supportEmail: 'support@example.com',
  legalEmail: 'legal@example.com',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  minimumAge: 13,
  freeCollectionLimit: 5,
  launchCategories: [
    'tattoos',
    'hairstyles',
    'outfits',
    'home-interiors',
    'food-recipes',
    'traditional-art',
    'digital-art',
    'photography',
    'crafts-diy',
    'furniture-woodworking',
    'weddings-events',
    'beauty-makeup',
    'landscaping-gardens',
  ],
} as const;

export type ProductConfig = typeof productConfig;
