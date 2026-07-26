import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Copyright — Humn',
  description: 'How ownership, licenses, infringement reports, responses, and repeat violations work on Humn.',
};

export default function CopyrightPage() {
  return (
    <main className="shell section reference-page">
      <header className="section-head page-first-section">
        <div>
          <div className="eyebrow">Legal · Effective July 25, 2026</div>
          <h1>Copyright.</h1>
          <p className="section-intro">
            Humn is built around creator credit and origin evidence, but it does not decide legal ownership merely from a badge, detector score, metadata field, or upload timestamp. Copyright concerns are reviewed as separate rights claims.
          </p>
        </div>
      </header>

      <section className="style-guide-section" aria-labelledby="copyright-ownership">
        <div className="panel-label">Ownership</div>
        <h2 id="copyright-ownership">Creators keep rights they already own.</h2>
        <p>
          Publishing on Humn does not transfer ownership to Humn. A creator grants only the operational license described in the Terms of use: enough permission to host, display, distribute, preserve, technically process, and review the material through the service.
        </p>
        <p className="method-hedge">
          A Humn origin badge does not establish copyright ownership, work-for-hire status, licensing rights, or freedom from third-party material.
        </p>
      </section>

      <section className="style-guide-section" aria-labelledby="copyright-report">
        <div className="panel-label">Reporting infringement</div>
        <h2 id="copyright-report">Use the Report this work link on the relevant Work.</h2>
        <p>
          A copyright report should identify the protected work, identify the Humn Work at issue, explain the claimed infringement, state whether you are the rights holder or authorized representative, and provide enough detail for Humn to evaluate the request through the reporting account.
        </p>
        <div className="reference-includes">
          <ul>
            <li>Describe the original work and where an authorized example can be found.</li>
            <li>Link or point to the specific Humn Work being reported.</li>
            <li>Explain which material is allegedly copied or unauthorized.</li>
            <li>State that the report is made in good faith and that the information supplied is accurate.</li>
            <li>Include any license, commission, publication, or ownership evidence that materially clarifies the claim.</li>
          </ul>
        </div>
        <p className="method-hedge">
          Reports are not automatic takedown commands. Humn may request clarification and may reject incomplete, abusive, or unsupported submissions.
        </p>
      </section>

      <section className="style-guide-section" aria-labelledby="copyright-response">
        <div className="panel-label">Review and response</div>
        <h2 id="copyright-response">Humn may restrict a Work while the claim is reviewed.</h2>
        <p>
          Depending on the clarity and urgency of the record, Humn may leave the Work available, reduce distribution, temporarily restrict it, remove it, or request a response from the account that published it. Humn may share the substance of the claim with the affected account so that person can understand and answer it.
        </p>
        <p>
          Where an account action creates an eligible strike, the affected user can use the private Account appeal flow. The response should identify permission, ownership, fair-use context, mistaken identification, or other evidence relevant to the claim.
        </p>
      </section>

      <section className="style-guide-section" aria-labelledby="copyright-repeat">
        <div className="panel-label">Repeat violations</div>
        <h2 id="copyright-repeat">Repeated upheld infringement can affect the account.</h2>
        <p>
          Humn may issue warnings, remove Works, apply posting cooldowns, suspend posting, or terminate accounts associated with repeated upheld copyright violations. The response is based on active, reviewable findings—not on the number of unproven reports submitted against an account.
        </p>
      </section>

      <section className="style-guide-section" aria-labelledby="copyright-abuse">
        <div className="panel-label">False or abusive claims</div>
        <h2 id="copyright-abuse">Do not use copyright reports to silence criticism or competitors.</h2>
        <p>
          Knowingly false ownership assertions, fabricated evidence, impersonation, coordinated reporting abuse, and reports made to harass a creator may themselves violate Humn&apos;s rules and can lead to restrictions.
        </p>
        <p>
          Humn cannot provide legal advice or finally adjudicate complex ownership disputes. Parties may need independent legal guidance or a court order when the record cannot be resolved through the platform.
        </p>
        <div className="actions">
          <Link className="button" href="/terms">Terms of use</Link>
          <Link className="button" href="/method/moderation-standard">Moderation standard</Link>
          <Link className="button" href="/account">Private account</Link>
        </div>
      </section>
    </main>
  );
}
