import type { CatalogueWork } from '../lib/dev-catalogue';
import { WorkCard } from './work-card';

export function MasonryFeed({ works, preview = false }: { works: CatalogueWork[]; preview?: boolean }) {
  return <div className={preview ? 'masonry masonry-preview' : 'masonry'}>
    {works.map((work, index) => <WorkCard key={work.id} work={work} priority={index < 3} />)}
  </div>;
}
