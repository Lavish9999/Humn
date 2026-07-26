import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy — Humn',
  description: 'What Humn stores, why it is used, what becomes public, and how account holders can export or delete their data.',
};

export default function PrivacyPage() {
  return (
    <main className="shell section reference-page">
      <header className="section-head page-first-section">
        <div>
          <div className="eyebrow">Legal · Effective July 25, 2026</div>
          <h1>Privacy.</h1>
          <p className="section-intro">
            Humn collects the information needed to operate accounts, publish Works, preserve origin evidence, run verification, enforce platform rules, and keep the service secure. This page explains the current product behavior in plain language.
          </p>
        </div>
      </header>

      <section className="style-guide-section" aria-labelledby="privacy-data">
        <div className="panel-label">Information Humn handles</div>
        <h2 id="privacy-data">Account, content, evidence, and service data.</h2>
        <div className="reference-includes">
          <ul>
            <li><strong>Account data:</strong> authentication details, handle, display name, avatar, preferences, and account standing.</li>
            <li><strong>Published content:</strong> Works, captions, Collections, follows, creator profiles, and other material you choose to share.</li>
            <li><strong>Origin evidence:</strong> original uploaded files, hashes, dimensions, timestamps, available metadata, Content Credentials, creator-authored process records, detector results, and review audit events.</li>
            <li><strong>Moderation data:</strong> reports, reasons, decisions, strikes, appeals, and resolution history.</li>
            <li><strong>Technical data:</strong> cookies, session information, request logs, browser or device details, error records, and security signals used to operate and protect the service.</li>
          </ul>
        </div>
      </section>

      <section className="style-guide-section" aria-labelledby="privacy-use">
        <div className="panel-label">How it is used</div>
        <h2 id="privacy-use">Humn uses data to provide the product you asked for.</h2>
        <div className="reference-includes">
          <ul>
            <li>Create and secure accounts and maintain signed-in sessions.</li>
            <li>Publish and organize Works, profiles, Collections, follows, and discovery results.</li>
            <li>Preserve original-file integrity and display accurate provenance status.</li>
            <li>Run automated origin detectors when verification is requested.</li>
            <li>Investigate reports, enforce rules, process appeals, and prevent abuse.</li>
            <li>Diagnose failures, measure service reliability, and improve Humn.</li>
          </ul>
        </div>
      </section>

      <section className="style-guide-section" aria-labelledby="privacy-public">
        <div className="panel-label">Public and private information</div>
        <h2 id="privacy-public">Publishing a Work makes selected information public—not the entire record.</h2>
        <p>
          Public profile fields, published Works, selected process evidence, Collections, follows, and public origin badges can be seen by other people. Account email, private settings, raw detector responses, strikes, appeals, internal audit records, and precise GPS coordinates are not presented as public profile information.
        </p>
        <p className="method-hedge">
          A public badge is a summary of the review state. It is not permission for Humn to publish every underlying private or security-sensitive signal.
        </p>
      </section>

      <section className="style-guide-section" aria-labelledby="privacy-metadata">
        <div className="panel-label">Camera metadata</div>
        <h2 id="privacy-metadata">Missing metadata is neutral. Precise location stays private.</h2>
        <p>
          Browsers and photo pickers, including common iPhone web-upload paths, can remove EXIF before Humn receives a file. Missing camera, capture-time, or GPS fields are not held against a creator and are not treated as evidence of AI generation.
        </p>
        <p>
          When location metadata is present, Humn may use its existence as an integrity signal, but precise coordinates are not displayed publicly.
        </p>
      </section>

      <section className="style-guide-section" aria-labelledby="privacy-sharing">
        <div className="panel-label">Service providers and disclosures</div>
        <h2 id="privacy-sharing">Some data is processed by infrastructure and review providers.</h2>
        <p>
          Humn relies on service providers for hosting, databases, private file storage, authentication, deployment, security, error monitoring, and automated origin detection. When a verification request runs, the relevant media may be sent to configured detector providers so they can return origin and deepfake signals.
        </p>
        <p>
          Humn may also disclose information when required by law, to protect users or the service, to investigate fraud or abuse, or as part of a business transfer. Humn does not sell private account data to advertisers.
        </p>
      </section>

      <section className="style-guide-section" aria-labelledby="privacy-control">
        <div className="panel-label">Your controls</div>
        <h2 id="privacy-control">Export, edit, or delete from your private Account page.</h2>
        <div className="reference-includes">
          <ul>
            <li>Edit your public display name and account preferences.</li>
            <li>Download the account information currently held by Humn as a JSON export.</li>
            <li>Delete the account through the server-side deletion flow.</li>
            <li>Appeal eligible strikes and review private account-standing history.</li>
          </ul>
        </div>
        <p className="method-hedge">
          Security logs, backups, legal holds, and records needed to resolve fraud, abuse, or disputes may take time to age out or may be retained when required by law.
        </p>
        <div className="actions">
          <Link className="button primary" href="/account">Manage my data</Link>
          <Link className="button" href="/method/proof-records">Read about proof records</Link>
        </div>
      </section>

      <section className="style-guide-section" aria-labelledby="privacy-security">
        <div className="panel-label">Security and changes</div>
        <h2 id="privacy-security">Humn limits access, but no online service is infallible.</h2>
        <p>
          Humn uses authenticated access, private storage for nonpublic evidence, server-only credentials, database access policies, and audit records to reduce unauthorized access. No system can guarantee perfect security.
        </p>
        <p>
          This notice may change as the product, providers, or legal requirements change. Material revisions will be reflected by an updated effective date on this page.
        </p>
      </section>
    </main>
  );
}
