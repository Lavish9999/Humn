export type ProvenanceVariant = 'verified' | 'awaiting' | 'declared';

const VERIFIED_STATUSES = new Set([
  'captured_live',
  'process_verified',
  'original_file_verified',
  'creator_verified',
  'review_complete',
]);

export function getProvenanceVariant(status: string | null | undefined): ProvenanceVariant {
  const normalized = String(status ?? '').toLowerCase();
  if (VERIFIED_STATUSES.has(normalized)) return 'verified';
  if (normalized === 'under_review') return 'awaiting';
  return 'declared';
}

export function getProvenanceLabel(
  status: string | null | undefined,
  proofCount = 0,
): string {
  const variant = getProvenanceVariant(status);
  if (variant === 'verified') return `VERIFIED · ${Math.max(0, proofCount)} PROOFS`;
  if (variant === 'awaiting') return 'AWAITING REVIEW';
  return 'DECLARED HUMAN-MADE';
}

export function ProvenanceBadge({
  status,
  proofCount = 0,
}: {
  status: string | null | undefined;
  proofCount?: number;
}) {
  const variant = getProvenanceVariant(status);
  return (
    <span className="badge provenance-badge" data-variant={variant}>
      {getProvenanceLabel(status, proofCount)}
    </span>
  );
}
