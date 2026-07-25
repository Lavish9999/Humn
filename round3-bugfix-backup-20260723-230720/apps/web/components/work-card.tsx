import Image from 'next/image';
import Link from 'next/link';
import type { CatalogueWork } from '../lib/dev-catalogue';

function provenanceLabel(work: CatalogueWork) {
  if (work.is_dev) return `TEST CONTENT · ${work.proof_count ?? 0} PROOFS`;
  return `${String(work.origin_status).replaceAll('_', ' ')} · PROOF RECORD`;
}

export function WorkCard({ work, priority = false }: { work: CatalogueWork; priority?: boolean }) {
  const href = work.is_dev ? `/search?q=${encodeURIComponent(work.title)}` : `/work/${work.id}`;
  const ratio = `${work.width} / ${work.height}`;
  return <Link className="work-card" href={href}>
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
        unoptimized={work.media_url.endsWith('.svg')}
      />
    </div>
    <div className="work-caption">
      <span className="creator-handle">@{work.creator_username}</span>
      <span className="badge provenance-badge">{provenanceLabel(work)}</span>
    </div>
  </Link>;
}
