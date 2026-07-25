import { PrelaunchReferencePage } from '../../components/prelaunch-reference-page';

export default function CopyrightPage() {
  return <PrelaunchReferencePage
    eyebrow="Legal"
    title="Copyright"
    summary="The final copyright page will explain ownership, attribution, infringement reporting, counter-notices, and repeat-infringer handling."
    includes={['Creator ownership and licenses', 'Copyright complaint requirements', 'Counter-notice process', 'Repeat-infringer policy']}
  />;
}
