import type { CategorySlug } from '@human/config';

export type ProofStoryEntry = {
  id: string;
  timestamp: string;
  label: string;
  note: string;
};

export type TechnicalSignal = {
  label: string;
  strength: number;
};

export type CatalogueWork = {
  id: string;
  title: string;
  description?: string | null;
  creator_id?: string;
  creator_name?: string;
  creator_username: string;
  origin_status: string;
  media_url: string;
  width: number;
  height: number;
  alt_text: string;
  published_at?: string | null;
  category_slug?: CategorySlug;
  proof_count?: number;
  proof_story?: ProofStoryEntry[];
  file_evidence?: Record<string, string>;
  technical_signals?: TechnicalSignal[];
  is_dev?: boolean;
};

type CategorySeed = {
  slug: CategorySlug;
  imageTerms: string;
  works: Array<{
    title: string;
    creator: string;
    description: string;
  }>;
};

const categorySeeds: CategorySeed[] = [
  {
    slug: 'tattoos',
    imageTerms: 'tattoo,artist,studio',
    works: [
      { title: 'Botanical sleeve study', creator: 'marisol.ink', description: 'A healed botanical sleeve built from field sketches and hand-drawn linework.' },
      { title: 'Blackwork moth placement', creator: 'northstar.tattoo', description: 'A symmetrical moth composition documented from stencil through healed result.' },
      { title: 'Fine-line shoulder flora', creator: 'softneedle', description: 'A restrained floral shoulder piece with placement notes and studio process.' },
      { title: 'Geometric calf revision', creator: 'axis.ink', description: 'A geometric calf project refined over two sessions with progress evidence.' },
    ],
  },
  {
    slug: 'hairstyles',
    imageTerms: 'hairstyle,hair,salon',
    works: [
      { title: 'Braided crown notes', creator: 'crownroom', description: 'A braided crown with texture preparation, sectioning, and finished views.' },
      { title: 'Copper bob color study', creator: 'tonehouse', description: 'A dimensional copper bob with color formula and maintenance notes.' },
      { title: 'Natural curl shaping', creator: 'coil.practice', description: 'A dry-shape curl cut documented before, during, and after styling.' },
      { title: 'Sculpted taper profile', creator: 'lineandfade', description: 'A clean taper profile with clipper progression and finishing details.' },
    ],
  },
  {
    slug: 'outfits',
    imageTerms: 'fashion,outfit,streetstyle',
    works: [
      { title: 'Linen evening layers', creator: 'mara.studio', description: 'A warm-weather evening look built around linen, leather, and soft tailoring.' },
      { title: 'Monochrome utility set', creator: 'form.daily', description: 'A compact utility wardrobe with garment tags and fit references.' },
      { title: 'Soft tailoring for dinner', creator: 'wearing.room', description: 'Relaxed tailoring balanced with a fitted knit and low-profile footwear.' },
      { title: 'Weekend denim proportion', creator: 'cutandwear', description: 'A denim-led look exploring cropped layers and wider trouser proportions.' },
    ],
  },
  {
    slug: 'home-interiors',
    imageTerms: 'interior,home,design',
    works: [
      { title: 'Small kitchen, warm oak', creator: 'fieldoffice', description: 'A compact kitchen renovation using warm oak, stone, and concealed storage.' },
      { title: 'Reading room in clay tones', creator: 'northwall.design', description: 'A quiet reading room organized around clay plaster and low shelving.' },
      { title: 'Narrow entry storage', creator: 'roompractice', description: 'A slim entry solution with built-in storage and durable finishes.' },
      { title: 'Daylit dining corner', creator: 'plainspace', description: 'A dining corner using natural light, vintage seating, and restrained color.' },
    ],
  },
  {
    slug: 'food-recipes',
    imageTerms: 'food,cooking,restaurant',
    works: [
      { title: 'Citrus tart process', creator: 'tableproof', description: 'A citrus tart with pastry stages, curd texture, and final assembly.' },
      { title: 'Charred tomato supper', creator: 'slowplate', description: 'A late-summer tomato dish with charred bread and herb oil.' },
      { title: 'Miso mushroom noodles', creator: 'pantry.record', description: 'A weeknight noodle recipe with timing notes and ingredient substitutions.' },
      { title: 'Stone-fruit breakfast', creator: 'morningtable', description: 'A simple breakfast plate built from stone fruit, cultured dairy, and grains.' },
    ],
  },
  {
    slug: 'traditional-art',
    imageTerms: 'painting,artist,canvas',
    works: [
      { title: 'Ochre figure study', creator: 'atelier.south', description: 'A painted figure study developed through charcoal, wash, and opaque color.' },
      { title: 'Harbor in four passes', creator: 'wetedge', description: 'A small harbor painting documented across four distinct paint passes.' },
      { title: 'Graphite hand series', creator: 'paperroom', description: 'A graphite drawing series focused on gesture, pressure, and edge control.' },
      { title: 'Two-color relief print', creator: 'pressroom', description: 'A hand-carved relief print with block preparation and registration notes.' },
    ],
  },
  {
    slug: 'digital-art',
    imageTerms: 'digital,art,creative',
    works: [
      { title: 'Night transit poster', creator: 'screenfield', description: 'A digital poster built from photographed textures and hand-drawn type.' },
      { title: 'Editorial portrait layers', creator: 'pixelatelier', description: 'A layered editorial portrait with process captures and brush history.' },
      { title: 'Map study in cobalt', creator: 'vectorhouse', description: 'A map-inspired composition developed from human-drawn paths and annotations.' },
      { title: 'Archive cover system', creator: 'typepractice', description: 'A digital cover system combining scanned material and custom typography.' },
    ],
  },
  {
    slug: 'photography',
    imageTerms: 'photography,portrait,film',
    works: [
      { title: 'Portrait on 35mm', creator: 'greywindow', description: 'A natural-light portrait made on 35mm film with contact-sheet evidence.' },
      { title: 'After-rain storefronts', creator: 'nightmeter', description: 'A street series focused on reflections, signage, and late-evening color.' },
      { title: 'Hands at the workbench', creator: 'closefocus', description: 'A documentary set following a maker through one afternoon of work.' },
      { title: 'Low-tide geometry', creator: 'shoreframe', description: 'A coastal photo study built around texture, tide lines, and negative space.' },
    ],
  },
  {
    slug: 'crafts-diy',
    imageTerms: 'craft,handmade,workshop',
    works: [
      { title: 'Salt-fired cup set', creator: 'earthturn', description: 'A wheel-thrown cup set with clay preparation, trimming, and kiln evidence.' },
      { title: 'Hand-bound field journal', creator: 'foldandsew', description: 'A cloth-bound field journal with sewing pattern and material notes.' },
      { title: 'Woven wall sample', creator: 'loomnotes', description: 'A woven wall sample exploring natural fibers and a limited color sequence.' },
      { title: 'Paper lantern prototype', creator: 'common.objects', description: 'A folded paper lantern prototype with cutting templates and assembly tests.' },
    ],
  },
  {
    slug: 'furniture-woodworking',
    imageTerms: 'furniture,woodworking,carpenter',
    works: [
      { title: 'Walnut joinery table', creator: 'northline.shop', description: 'A walnut table documented from board selection through final joinery.' },
      { title: 'Ash bedside cabinet', creator: 'benchline', description: 'A compact ash cabinet with dovetail tests and a hand-rubbed finish.' },
      { title: 'Low oak reading chair', creator: 'grainwork', description: 'A low reading chair developed through mockups, templates, and final assembly.' },
      { title: 'Pine storage wall', creator: 'localjoinery', description: 'A full-height pine storage wall designed around an irregular room.' },
    ],
  },
  {
    slug: 'weddings-events',
    imageTerms: 'wedding,event,flowers',
    works: [
      { title: 'Courtyard ceremony plan', creator: 'softlight.events', description: 'A courtyard ceremony plan with floral tests, seating, and setup sequence.' },
      { title: 'Dinner table in rust', creator: 'gathered.studio', description: 'A dinner setting using rust linen, local flowers, and handmade menus.' },
      { title: 'City hall bouquet', creator: 'stemarchive', description: 'A compact city-hall bouquet with ingredient list and construction process.' },
      { title: 'Evening reception lighting', creator: 'afterglow.events', description: 'A reception lighting plan balancing candles, practicals, and overhead light.' },
    ],
  },
  {
    slug: 'beauty-makeup',
    imageTerms: 'makeup,beauty,portrait',
    works: [
      { title: 'Soft chrome eye', creator: 'facepractice', description: 'A reflective eye look built in thin layers with product and lighting notes.' },
      { title: 'Warm editorial skin', creator: 'toneandlight', description: 'An editorial skin treatment focused on warm tone and visible texture.' },
      { title: 'Graphic liner study', creator: 'lineface', description: 'A graphic liner study tested across three shapes before the final look.' },
      { title: 'Bridal trial record', creator: 'quietglam', description: 'A complete bridal trial record with wear notes and product adjustments.' },
    ],
  },
  {
    slug: 'landscaping-gardens',
    imageTerms: 'garden,landscape,plants',
    works: [
      { title: 'Gravel path study', creator: 'common.ground', description: 'A gravel path and planting study with seasonal progress photographs.' },
      { title: 'Courtyard shade planting', creator: 'greenroom.land', description: 'A shade-tolerant courtyard plan organized around texture and leaf shape.' },
      { title: 'Small edible border', creator: 'plotpractice', description: 'A compact edible border combining herbs, flowers, and perennial structure.' },
      { title: 'Rain garden section', creator: 'watershed.studio', description: 'A rain-garden section documented from grading through first establishment.' },
    ],
  },
];

const ratios = [
  { width: 800, height: 1200, label: '2:3' },
  { width: 900, height: 900, label: '1:1' },
  { width: 960, height: 1200, label: '4:5' },
  { width: 1200, height: 800, label: '3:2' },
  { width: 720, height: 1280, label: '9:16' },
] as const;

const statusPattern = [
  'process_verified',
  'original_file_verified',
  'under_review',
  'captured_live',
  'not_yet_verified',
  'creator_verified',
  'under_review',
  'review_complete',
  'process_verified',
  'under_review',
  'original_file_verified',
  'not_yet_verified',
  'captured_live',
  'creator_verified',
  'under_review',
  'process_verified',
  'review_complete',
  'not_yet_verified',
  'under_review',
  'original_file_verified',
] as const;

const proofStages = [
  ['09:10', 'Initial reference', 'The creator recorded the source material and working intention.'],
  ['10:25', 'Material preparation', 'Tools, materials, or files were documented before substantive work began.'],
  ['12:40', 'Early stage', 'An intermediate state shows the work developing through a human process.'],
  ['15:05', 'Mid-process review', 'A later stage preserves visible continuity with the final work.'],
  ['17:20', 'Final adjustments', 'The creator documented finishing decisions and ordinary edits.'],
  ['18:10', 'Finished work', 'The final media was attached to the same origin record.'],
] as const;

function buildProofStory(index: number, declared: boolean): ProofStoryEntry[] {
  const count = declared && index === 4 ? 0 : index % 7;
  return proofStages.slice(0, count).map(([timestamp, label, note], stageIndex) => ({
    id: `proof-${index + 1}-${stageIndex + 1}`,
    timestamp,
    label,
    note,
  }));
}

const interleavedSeeds = Array.from({ length: 4 }, (_, workIndex) =>
  categorySeeds.map(category => ({ category, work: category.works[workIndex]! })),
).flat();

export const devCatalogue: CatalogueWork[] = interleavedSeeds.map(({ category, work }, index) => {
  const ratio = ratios[index % ratios.length]!;
  const originStatus = statusPattern[index % statusPattern.length]!;
  const declared = originStatus === 'not_yet_verified';
  const proofStory = buildProofStory(index, declared);
  const creatorSlug = work.creator.replaceAll('.', '-');
  const categoryTerms = encodeURIComponent(category.imageTerms);

  return {
    id: `dev-${category.slug}-${Math.floor(index / categorySeeds.length) + 1}`,
    title: work.title,
    description: work.description,
    creator_id: `dev-creator-${creatorSlug}`,
    creator_name: work.creator,
    creator_username: work.creator,
    origin_status: originStatus,
    media_url: `https://loremflickr.com/${ratio.width}/${ratio.height}/${categoryTerms}?lock=${1200 + index}`,
    width: ratio.width,
    height: ratio.height,
    alt_text: `${work.title}, a development catalogue photograph in the ${category.slug} category.`,
    published_at: new Date(Date.UTC(2026, 6, 23 - (index % 18), 14, 0, 0)).toISOString(),
    category_slug: category.slug,
    proof_count: proofStory.length,
    proof_story: proofStory,
    file_evidence: {
      dimensions: `${ratio.width} × ${ratio.height}px`,
      format: index % 3 === 0 ? 'Original JPEG' : index % 3 === 1 ? 'Original HEIC' : 'Camera RAW + derivative',
      capture: index % 4 === 0 ? 'In-app capture session' : 'Original file received',
      record: `DEV-${String(index + 1).padStart(4, '0')}`,
    },
    technical_signals: [
      { label: 'Metadata consistency', strength: originStatus === 'under_review' ? 2 : declared ? 1 : 4 },
      { label: 'Process continuity', strength: Math.min(5, Math.max(1, proofStory.length)) },
      { label: 'Duplicate review', strength: index % 6 === 0 ? 3 : 4 },
      { label: 'Creator history', strength: declared ? 2 : 4 },
    ],
    is_dev: true,
  };
});

export const devModeCatalogue = process.env.NEXT_PUBLIC_APP_ENV !== 'production' ? devCatalogue : [];
