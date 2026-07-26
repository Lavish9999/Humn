import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of use — Humn',
  description: 'The rules for using Humn, publishing work, making origin claims, and participating in the platform.',
};

export default function TermsPage() {
  return (
    <main className="shell section reference-page">
      <header className="section-head page-first-section">
        <div>
          <div className="eyebrow">Legal · Effective July 25, 2026</div>
          <h1>Terms of use.</h1>
          <p className="section-intro">
            These terms govern use of Humn. By creating an account, publishing a Work, or otherwise using the service, you agree to follow these rules and the policies linked from this page.
          </p>
        </div>
      </header>

      <section className="style-guide-section" aria-labelledby="terms-account">
        <div className="panel-label">Accounts</div>
        <h2 id="terms-account">Use an account you are authorized to control.</h2>
        <div className="reference-includes">
          <ul>
            <li>Provide accurate account information and keep access credentials secure.</li>
            <li>Do not impersonate another person, creator, brand, or organization.</li>
            <li>Do not evade a suspension, cooldown, deletion, or other account restriction.</li>
            <li>You are responsible for activity performed through your account unless you promptly report unauthorized access.</li>
          </ul>
        </div>
      </section>

      <section className="style-guide-section" aria-labelledby="terms-content">
        <div className="panel-label">Your content</div>
        <h2 id="terms-content">You keep ownership of material you own.</h2>
        <p>
          You retain ownership of your original content. By publishing through Humn, you grant Humn a nonexclusive, worldwide license to host, store, reproduce, display, distribute, format, and technically process that content only as needed to operate, secure, promote, and improve the service.
        </p>
        <p>
          That license includes creating delivery copies, preserving private evidence records, displaying public Works and Collections, and sending relevant media to configured origin-detection providers when verification is requested. The license ends when the content is deleted, subject to reasonable technical, backup, legal, and dispute-resolution needs.
        </p>
      </section>

      <section className="style-guide-section" aria-labelledby="terms-origin">
        <div className="panel-label">Origin claims and verification</div>
        <h2 id="terms-origin">Make claims you can honestly support.</h2>
        <div className="reference-includes">
          <ul>
            <li>Do not knowingly present AI-generated or materially misrepresented content as wholly human-created.</li>
            <li>Do not falsify process evidence, metadata, Content Credentials, screenshots, timestamps, or proof records.</li>
            <li>Do not photograph or re-upload generated content to evade origin review.</li>
            <li>Do not interpret a public badge more broadly than Humn defines it.</li>
          </ul>
        </div>
        <p className="method-hedge">
          VERIFIED · AUTOMATED CLEAR means cleared by Humn&apos;s automated origin detectors. It does not mean human-reviewed and does not guarantee authorship, originality, ownership, or detector perfection.
        </p>
      </section>

      <section className="style-guide-section" aria-labelledby="terms-prohibited">
        <div className="panel-label">Prohibited use</div>
        <h2 id="terms-prohibited">Do not use Humn to harm people, creators, or the service.</h2>
        <div className="reference-includes">
          <ul>
            <li>Upload content you do not have permission to use.</li>
            <li>Harass, threaten, exploit, deceive, or expose another person&apos;s private information.</li>
            <li>Submit knowingly false reports, copyright claims, appeals, or ownership assertions.</li>
            <li>Scrape, reverse engineer, overload, bypass access controls, probe private systems, or interfere with service operation.</li>
            <li>Use automated accounts, spam, manipulation, or coordinated activity to distort discovery, follows, saves, reports, or reputation.</li>
            <li>Use Humn for unlawful activity or to violate another person&apos;s rights.</li>
          </ul>
        </div>
      </section>

      <section className="style-guide-section" aria-labelledby="terms-enforcement">
        <div className="panel-label">Moderation and enforcement</div>
        <h2 id="terms-enforcement">Humn may limit content or accounts when the record supports it.</h2>
        <p>
          Humn may reject verification, reduce distribution, request clarification, remove content, issue strikes, apply posting cooldowns, suspend access, or delete accounts when needed to enforce these terms, protect the service, comply with law, or address repeated upheld violations.
        </p>
        <p>
          Missing metadata and a self-declared badge are not violations by themselves. Eligible account actions can be appealed through the private Account page, and Humn may restore content or standing when an appeal changes the finding.
        </p>
      </section>

      <section className="style-guide-section" aria-labelledby="terms-service">
        <div className="panel-label">Service and liability</div>
        <h2 id="terms-service">Humn is provided as an evolving online service.</h2>
        <p>
          Features, detector providers, thresholds, availability, storage limits, and discovery behavior may change. Humn may experience interruptions, errors, data loss, false positives, false negatives, or security incidents. Automated review and provenance evidence are useful signals, not guarantees.
        </p>
        <p>
          To the maximum extent permitted by law, Humn is provided “as is” and “as available,” without warranties that the service will be uninterrupted, error-free, or suitable for every purpose. Humn is not responsible for disputes between users over ownership, authorship, contracts, or offline transactions merely because content appeared on the platform.
        </p>
      </section>

      <section className="style-guide-section" aria-labelledby="terms-changes">
        <div className="panel-label">Changes and contact paths</div>
        <h2 id="terms-changes">Continued use follows the terms then in effect.</h2>
        <p>
          Humn may update these terms as the product or legal requirements change. Material revisions will be reflected by a new effective date. Stop using the service and delete your account if you do not agree to an updated version.
        </p>
        <p>
          Use the Report this work link for a concern tied to a specific Work. Use the private Account page for export, deletion, standing, and eligible appeals.
        </p>
        <div className="actions">
          <Link className="button" href="/method/moderation-standard">Moderation standard</Link>
          <Link className="button" href="/copyright">Copyright process</Link>
          <Link className="button" href="/account">Private account</Link>
        </div>
      </section>
    </main>
  );
}
