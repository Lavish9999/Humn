import type { ProvenanceVariant } from '../lib/data/types';

export const AUTOMATED_VERIFIED_EXPLANATION = "Cleared by Humn's automated origin detectors.";

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
      label: 'VERIFIED · AUTOMATED CLEAR',
    };
  }

  if (normalizedProofCount >= 1) {
    return { variant: 'awaiting', label: 'AWAITING AUTOMATED REVIEW' };
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
  const explanation = provenance.variant === 'verified'
    ? AUTOMATED_VERIFIED_EXPLANATION
    : provenance.variant === 'awaiting'
      ? 'Automated detectors are running or the result has been escalated because they could not safely agree.'
      : 'The creator supplied this Work, but Humn has not cleared it through the automated detector pipeline.';

  return (
    <span
      className="badge provenance-badge"
      data-variant={provenance.variant}
      title={explanation}
      aria-label={`${provenance.label}. ${explanation}`}
    >
      {provenance.label}
    </span>
  );
}
