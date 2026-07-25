import { PrelaunchReferencePage } from '../../../components/prelaunch-reference-page';

export default function ModerationStandardPage() {
  return <PrelaunchReferencePage
    eyebrow="Provenance & method"
    title="Moderation standard"
    summary="This page will publish Humn's review standard for verification requests, reports, removals, strikes, reviewer accountability, and appeals."
    includes={['When human review is triggered', 'Approval, rejection, and removal standards', 'Confident-evidence requirements for strikes', 'Appeals, reversals, and audit records']}
  />;
}
