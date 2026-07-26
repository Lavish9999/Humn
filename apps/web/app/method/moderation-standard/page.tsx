import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Moderation standard — Humn',
  description: 'How Humn separates automated origin review from reports, policy enforcement, strikes, and appeals.',
};

export default function ModerationStandardPage() {
  return (
    <main className="shell section reference-page">
      <header className="section-head page-first-section">
        <div>
          <div className="eyebrow">Provenance &amp; method</div>
          <h1>Moderation standard.</h1>
          <p className="section-intro">
            Humn separates automated origin review from policy enforcement. A detector result can inform a Work&apos;s origin status; reports, ownership disputes, strikes, removals, and appeals require a reviewable reason and an audit trail.
          </p>
        </div>
      </header>

      <section className="style-guide-section" aria-labelledby="separate-systems">
        <div className="panel-label">Two different systems</div>
        <h2 id="separate-systems">Origin status is not a misconduct verdict.</h2>
        <div className="reference-includes">
          <ul>
            <li>Automated origin review can clear, reject, or escalate a verification request.</li>
            <li>A VERIFIED · AUTOMATED CLEAR badge is not human review and does not immunize a Work from reports.</li>
            <li>An UNVERIFIED · SELF-DECLARED badge is neutral and does not mean the creator violated a rule.</li>
            <li>Policy enforcement considers the specific report, available evidence, account history, and any response or appeal.</li>
          </ul>
        </div>
      </section>

      <section className="style-guide-section" aria-labelledby="evidence-standard">
        <div className="panel-label">Evidence standard</div>
        <h2 id="evidence-standard">Humn does not punish from appearance alone.</h2>
        <div className="reference-includes">
          <ul>
            <li>Missing EXIF, camera fields, or location data is neutral.</li>
            <li>An unusual style, polished finish, or detector disagreement is not by itself proof of deception.</li>
            <li>Explicit AI-origin Content Credentials may support a strong technical finding.</li>
            <li>Ownership, plagiarism, impersonation, and false-proof concerns require concrete, reviewable evidence.</li>
            <li>Uncertain automated results are escalated rather than silently treated as clear.</li>
          </ul>
        </div>
        <p className="method-hedge">
          The standard is confidence proportional to consequence: the more serious the account action, the stronger and more reviewable the evidence must be.
        </p>
      </section>

      <section className="style-guide-section" aria-labelledby="possible-actions">
        <div className="panel-label">Possible actions</div>
        <h2 id="possible-actions">The response should match the finding.</h2>
        <div className="reference-includes">
          <ul>
            <li><strong>No action:</strong> the report is unsupported, duplicated, or does not describe a policy concern.</li>
            <li><strong>Request clarification or resubmission:</strong> evidence is incomplete or the creator can resolve the concern.</li>
            <li><strong>Reject or remove a Work:</strong> the specific Work fails origin or policy requirements.</li>
            <li><strong>Issue a strike:</strong> an explicit technical credential or human-upheld ownership or proof violation supports account-level enforcement.</li>
          </ul>
        </div>
      </section>

      <section className="style-guide-section" aria-labelledby="graduated-response">
        <div className="panel-label">Graduated response</div>
        <h2 id="graduated-response">Account restrictions increase only after upheld violations.</h2>
        <div className="reference-includes">
          <ol>
            <li><strong>First active strike:</strong> educational warning; the violating upload is blocked or removed, while posting remains available.</li>
            <li><strong>Second active strike:</strong> formal warning and a seven-day posting cooldown; browsing remains available.</li>
            <li><strong>Third active strike:</strong> posting suspension pending appeal.</li>
          </ol>
        </div>
        <p className="method-hedge">
          Missing provenance does not create a strike. A self-declared Work can remain outside default discovery without becoming an account violation.
        </p>
      </section>

      <section className="style-guide-section" aria-labelledby="appeals">
        <div className="panel-label">Appeals and accountability</div>
        <h2 id="appeals">Actions must be explainable and reversible.</h2>
        <p>
          Humn records the reason, source, timing, reviewer action, and appeal outcome for moderation decisions. Eligible strikes can be appealed from the private Account page. An appeal can uphold, reverse, or modify the action based on the record and any new evidence.
        </p>
        <p>
          Reviewer tools are for resolving reports and escalations—not for rewriting technical evidence or presenting an automated clearance as human verification.
        </p>
        <div className="actions">
          <Link className="button" href="/account">View private account</Link>
          <Link className="button" href="/method/origin-status">How verification works</Link>
        </div>
      </section>
    </main>
  );
}
