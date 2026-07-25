import { PrelaunchReferencePage } from '../../../components/prelaunch-reference-page';

export default function OriginStatusPage() {
  return <PrelaunchReferencePage
    eyebrow="Provenance & method"
    title="Origin status"
    summary="This page will document exactly what VERIFIED, AWAITING REVIEW, and UNVERIFIED · SELF-DECLARED mean—and what none of those labels can prove absolutely."
    includes={['Badge definitions and eligibility', 'Neutral treatment of missing metadata', 'C2PA and capture-origin handling', 'Feed eligibility and ranking consequences']}
  />;
}
