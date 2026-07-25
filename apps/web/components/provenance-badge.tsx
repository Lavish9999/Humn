import { pluralize } from '../lib/pluralize';
import type { ProvenanceVariant } from '../lib/data/types';

export function deriveProvenance({
  proofCount,
  reviewComplete,
}: {
  proofCount: number;
  reviewComplete: boolean;
}): { variant: ProvenanceVariant; label: string } {
  const normalizedProofCount = Math.max(
    0,
    Math.floor(Number.isFinite(proofCount) ? proofCount : 0),
  );

  if (reviewComplete && normalizedProofCount >= 1) {
    return {
      variant: 'verified',
      label: `VERIFIED · ${pluralize(normalizedProofCount, 'PROOF', 'PROOFS')}`,
    };
  }

  if (normalizedProofCount >= 1) {
    return { variant: 'awaiting', label: 'AWAITING REVIEW' };
  }

  return { variant: 'unverified', label: 'UNVERIFIED · SELF-DECLARED' };
}

export function ProvenanceBadge({
  proofCount = 0,
  reviewComplete = false,
  variant,
  label,
}: {
  proofCount?: number;
  reviewComplete?: boolean;
  variant?: ProvenanceVariant;
  label?: string;
}) {
  const provenance = variant && label
    ? { variant, label }
    : deriveProvenance({ proofCount, reviewComplete });

  return (
    <span
      className="badge provenance-badge"
      data-variant={provenance.variant}
    >
      {provenance.label}
    </span>
  );
}
