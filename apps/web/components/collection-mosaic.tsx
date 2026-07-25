'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { WorkRecord } from '../lib/data/types';

export function CollectionMosaic({ works, workCount }: { works: WorkRecord[]; workCount: number }) {
  if (workCount === 0) {
    return (
      <div className="collection-mosaic collection-mosaic-empty" aria-label="No saved Works">
        {Array.from({ length: 4 }, (_, index) => (
          <span className="mosaic-cell" key={index}>
            {index === 0 ? <span className="meta mosaic-empty-label">No saved works</span> : null}
          </span>
        ))}
      </div>
    );
  }

  const hasOverflow = workCount > 4;
  const visible = hasOverflow ? works.slice(0, 3) : works.slice(0, 4);
  const cells: React.ReactNode[] = visible.map(work => (
    <Link className="mosaic-cell" href={`/work/${work.id}`} key={work.id} aria-label={`Open ${work.title}`}>
      <span className="media-skeleton" aria-hidden="true" />
      <Image src={work.media_url} alt={work.alt_text} width={work.width} height={work.height} unoptimized />
    </Link>
  ));

  if (hasOverflow) {
    cells.push(
      <span className="mosaic-cell mosaic-overflow" key="overflow" aria-label={`${workCount - 3} more Works`}>
        +{workCount - 3}
      </span>,
    );
  }

  while (cells.length < 4) cells.push(<span className="mosaic-cell" key={`empty-${cells.length}`} />);
  return <div className="collection-mosaic">{cells}</div>;
}
