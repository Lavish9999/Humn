import type { ProvenanceVariant } from '../lib/data/types';

export const AUTOMATED_VERIFIED_EXPLANATION = "Two independent automated origin checks cleared this Work under Humn's current thresholds.";

const PUBLIC_PROVENANCE_LABELS: Record<ProvenanceVariant, string> = {
  verified: 'ORIGIN CHECK PASSED',
  awaiting: 'ORIGIN CHECK IN PROGRESS',
  unverified: 'CREATOR DECLARED',
};

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
      label: PUBLIC_PROVENANCE_LABELS.verified,
    };
  }

  if (normalizedProofCount >= 1) {
    return { variant: 'awaiting', label: PUBLIC_PROVENANCE_LABELS.awaiting };
  }

  return { variant: 'unverified', label: PUBLIC_PROVENANCE_LABELS.unverified };
}

export function ProvenanceBadge(props: {
  proofCount?: number;
  reviewComplete?: boolean;
  variant?: ProvenanceVariant;
  label?: string;
}) {
  const {
    proofCount = 0,
    reviewComplete = false,
    variant,
  } = props;
  const provenance = variant
    ? { variant, label: PUBLIC_PROVENANCE_LABELS[variant] }
    : deriveProvenance({ proofCount, reviewComplete });
  const explanation = provenance.variant === 'verified'
    ? `${AUTOMATED_VERIFIED_EXPLANATION} This is not proof of human authorship.`
    : provenance.variant === 'awaiting'
      ? 'Humn’s automated origin checks are currently processing this Work.'
      : 'The creator supplied this Work, but Humn has not cleared it through the automated origin checks.';

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
