import { PrelaunchReferencePage } from '../../components/prelaunch-reference-page';

export default function TermsPage() {
  return <PrelaunchReferencePage
    eyebrow="Legal"
    title="Terms of use"
    summary="The final terms will define permitted use of Humn, creator responsibilities, account enforcement, appeals, and service limitations."
    includes={['Creator representations and ownership', 'Acceptable use and prohibited conduct', 'Moderation, strikes, and appeals', 'Service availability and limitation of liability']}
  />;
}
