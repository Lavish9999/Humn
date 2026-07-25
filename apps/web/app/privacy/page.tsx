import { PrelaunchReferencePage } from '../../components/prelaunch-reference-page';

export default function PrivacyPage() {
  return <PrelaunchReferencePage
    eyebrow="Legal"
    title="Privacy"
    summary="Humn's complete privacy policy will explain what account, upload, evidence, moderation, and usage data the service stores and why."
    includes={['Account and profile data', 'Uploaded files and recorded evidence', 'Moderation and appeal records', 'Retention, export, and deletion rights']}
  />;
}
