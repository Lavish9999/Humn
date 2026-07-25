export type CatalogueWork = {
  id: string;
  title: string;
  creator_username: string;
  origin_status: string;
  media_url: string;
  width: number;
  height: number;
  alt_text: string;
  proof_count?: number;
  is_dev?: boolean;
};

export const devCatalogue: CatalogueWork[] = [
  { id: 'dev-ink-01', title: 'Botanical sleeve study', creator_username: 'marisol.ink', origin_status: 'process_verified', media_url: '/dev-catalogue/botanical.svg', width: 900, height: 1200, alt_text: 'Development-only botanical tattoo study placeholder.', proof_count: 4, is_dev: true },
  { id: 'dev-wood-02', title: 'Walnut joinery table', creator_username: 'northline.shop', origin_status: 'original_file_verified', media_url: '/dev-catalogue/walnut.svg', width: 1200, height: 900, alt_text: 'Development-only walnut furniture placeholder.', proof_count: 6, is_dev: true },
  { id: 'dev-hair-03', title: 'Braided crown notes', creator_username: 'crownroom', origin_status: 'under_review', media_url: '/dev-catalogue/braids.svg', width: 900, height: 1120, alt_text: 'Development-only braided hairstyle placeholder.', proof_count: 3, is_dev: true },
  { id: 'dev-room-04', title: 'Small kitchen, warm oak', creator_username: 'fieldoffice', origin_status: 'review_complete', media_url: '/dev-catalogue/kitchen.svg', width: 1200, height: 1450, alt_text: 'Development-only interior design placeholder.', proof_count: 5, is_dev: true },
  { id: 'dev-clay-05', title: 'Salt-fired cup set', creator_username: 'earthturn', origin_status: 'creator_verified', media_url: '/dev-catalogue/ceramics.svg', width: 1000, height: 1000, alt_text: 'Development-only ceramics placeholder.', proof_count: 4, is_dev: true },
  { id: 'dev-style-06', title: 'Linen evening layers', creator_username: 'mara.studio', origin_status: 'not_yet_verified', media_url: '/dev-catalogue/linen.svg', width: 900, height: 1350, alt_text: 'Development-only outfit placeholder.', proof_count: 4, is_dev: true },
  { id: 'dev-photo-07', title: 'Portrait on 35mm', creator_username: 'greywindow', origin_status: 'captured_live', media_url: '/dev-catalogue/portrait.svg', width: 1200, height: 800, alt_text: 'Development-only film photography placeholder.', proof_count: 2, is_dev: true },
  { id: 'dev-garden-08', title: 'Gravel path study', creator_username: 'common.ground', origin_status: 'process_verified', media_url: '/dev-catalogue/garden.svg', width: 1000, height: 1250, alt_text: 'Development-only garden design placeholder.', proof_count: 5, is_dev: true },
  { id: 'dev-food-09', title: 'Citrus tart process', creator_username: 'tableproof', origin_status: 'original_file_verified', media_url: '/dev-catalogue/tart.svg', width: 1000, height: 760, alt_text: 'Development-only food and recipe placeholder.', proof_count: 7, is_dev: true },
  { id: 'dev-floral-10', title: 'Late-summer arrangement', creator_username: 'stemarchive', origin_status: 'review_complete', media_url: '/dev-catalogue/floral.svg', width: 900, height: 1200, alt_text: 'Development-only floral design placeholder.', proof_count: 4, is_dev: true },
  { id: 'dev-print-11', title: 'Two-color relief print', creator_username: 'pressroom', origin_status: 'creator_verified', media_url: '/dev-catalogue/print.svg', width: 1100, height: 900, alt_text: 'Development-only printmaking placeholder.', proof_count: 6, is_dev: true },
  { id: 'dev-event-12', title: 'Courtyard ceremony plan', creator_username: 'softlight.events', origin_status: 'under_review', media_url: '/dev-catalogue/wedding.svg', width: 1000, height: 1300, alt_text: 'Development-only wedding design placeholder.', proof_count: 5, is_dev: true },
];

export const devModeCatalogue = process.env.NEXT_PUBLIC_APP_ENV !== 'production' ? devCatalogue : [];
