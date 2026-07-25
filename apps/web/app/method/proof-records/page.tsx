import { PrelaunchReferencePage } from '../../../components/prelaunch-reference-page';

export default function ProofRecordsPage() {
  return <PrelaunchReferencePage
    eyebrow="Provenance & method"
    title="Proof records"
    summary="This page will explain Proof Stories, file evidence, hashes, timestamps, technical signals, and the limits of each evidence type."
    includes={['Creator-authored process entries', 'Original-file and metadata records', 'Hash and duplicate checks', 'Why evidence informs review without becoming an absolute guarantee']}
  />;
}
