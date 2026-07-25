import Image from 'next/image';
import Link from 'next/link';
import type { CatalogueWork } from '../lib/dev-catalogue';
import { ProvenanceBadge } from './provenance-badge';

export function WorkCard({ work, priority = false }: { work: CatalogueWork; priority?: boolean }) {
  const ratio = `${work.width} / ${work.height}`;
  const isRemote = work.media_url.startsWith('http');

  return (
    <Link className="work-card" href={`/work/${work.id}`} aria-label={`Open ${work.title} by @${work.creator_username}`}>
      <div className="media-frame" style={{ aspectRatio: ratio }}>
        <span className="media-skeleton" aria-hidden="true" />
        <Image
          className="work-media"
          src={work.media_url}
          alt={work.alt_text ?? work.title}
          width={work.width}
          height={work.height}
          sizes="(max-width: 639px) 50vw, (max-width: 767px) 33vw, (max-width: 1023px) 25vw, 20vw"
          priority={priority}
          unoptimized={isRemote || work.media_url.endsWith('.svg')}
        />
      </div>
      <div className="work-caption">
        <span className="creator-handle">@{work.creator_username}</span>
        <ProvenanceBadge status={work.origin_status} proofCount={work.proof_count ?? 0} />
      </div>
    </Link>
  );
}
