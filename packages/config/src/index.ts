export const categoryLabels = {
  tattoos: 'Tattoos',
  hairstyles: 'Hairstyles',
  outfits: 'Outfits',
  'home-interiors': 'Home Interiors',
  'food-recipes': 'Food & Recipes',
  'traditional-art': 'Traditional Art',
  'digital-art': 'Digital Art',
  photography: 'Photography',
  'crafts-diy': 'Crafts & DIY',
  'furniture-woodworking': 'Furniture & Woodworking',
  'weddings-events': 'Weddings & Events',
  'beauty-makeup': 'Beauty & Makeup',
  'landscaping-gardens': 'Landscaping & Gardens',
} as const;

export type CategorySlug = keyof typeof categoryLabels;

export function getCategoryDisplayName(slug: string) {
  return categoryLabels[slug as CategorySlug] ?? 'Uncategorized';
}

export const productConfig = {
  name: 'Humn',
  tagline: 'Real inspiration, made by real people.',
  description: 'The trusted discovery platform for human-created work.',
  supportEmail: 'support@example.com',
  legalEmail: 'legal@example.com',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? '',
  minimumAge: 13,
  freeCollectionLimit: 5,
  launchCategories: Object.keys(categoryLabels) as CategorySlug[],
} as const;

export type ProductConfig = typeof productConfig;

