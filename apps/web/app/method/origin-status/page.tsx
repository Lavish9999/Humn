import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AUTOMATED_VERIFIED_EXPLANATION,
  ProvenanceBadge,
} from '../../../components/provenance-badge';

export const metadata: Metadata = {
  title: 'How verification works — Humn',
  description: 'A plain-language guide to Humn’s self-declared, automated-review, and automated-clear origin labels.',
};

const verificationStates = [
  {
    variant: 'unverified' as const,
    label: 'UNVERIFIED · SELF-DECLARED',
    heading: 'The creator made the claim.',
    body: 'The Work was submitted as human-made, but Humn has not cleared it through the automated detector pipeline. This label is neutral: it is not an accusation, endorsement, or automated finding. Uncertain completed reviews return to this state instead of waiting indefinitely for a reviewer.',
  },
  {
    variant: 'awaiting' as const,
    label: 'AWAITING AUTOMATED REVIEW',
    heading: 'The automated review is actively processing.',
    body: 'Humn has queued or started its detector and provenance checks. AWAITING is a temporary processing state—not a permanent holding area. When the run completes, the Work becomes VERIFIED, REJECTED, or returns to SELF-DECLARED.',
  },
  {
    variant: 'verified' as const,
    label: 'VERIFIED · AUTOMATED CLEAR',
    heading: AUTOMATED_VERIFIED_EXPLANATION,
    body: 'Two independent content detectors cleared the Work under Humn’s configured thresholds, required AI/deepfake/confidence scores were present, and no blocking integrity or local screen-rephotograph signal was present. This is an automated result. It is not human-reviewed and it is not a guarantee of authorship, originality, copyright ownership, or perfect detector accuracy.',
  },
];

export default function OriginStatusPage() {
  return (
    <main className="shell section reference-page">
      <header className="section-head page-first-section">
        <div>
          <div className="eyebrow">Provenance &amp; method</div>
          <h1>How verification works.</h1>
          <p className="section-intro">
            Humn labels what its review system has actually established. The labels describe the state of an automated origin review; they do not claim certainty where none exists.
          </p>
        </div>
      </header>

      <section className="style-guide-section" aria-labelledby="verification-states">
        <div className="panel-label">The three public states</div>
        <h2 id="verification-states">Read the badge literally.</h2>
        <div className="reference-includes">
          {verificationStates.map(state => (
            <article key={state.variant} className="provenance-signal">
              <div className="badge-specimens">
                <ProvenanceBadge variant={state.variant} label={state.label} />
              </div>
              <h3>{state.heading}</h3>
              <p>{state.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="style-guide-section" aria-labelledby="signals-heading">
        <div className="panel-label">What the system considers</div>
        <h2 id="signals-heading">Multiple signals, not one magic test.</h2>
        <div className="reference-includes">
          <ul>
            <li>Independent AI-generation and deepfake detector scores.</li>
            <li>Original-file integrity, duplicate hashes, Content Credentials, and available camera metadata.</li>
            <li>Partial screen-rephotograph heuristics such as moiré, display-like borders, and reflection patterns.</li>
            <li>Process evidence supplied by the creator as supporting context.</li>
          </ul>
        </div>
        <p className="method-hedge">
          Every score is a signal, not a verdict by itself. Strong synthetic signals can reject a submission. Disagreement, low confidence, unavailable checks, incomplete scores, duplicate concerns, or suspected screen rephotography do not auto-pass; the Work publishes as SELF-DECLARED instead.
        </p>
      </section>

      <section className="style-guide-section" aria-labelledby="metadata-heading">
        <div className="panel-label">Camera metadata</div>
        <h2 id="metadata-heading">Missing EXIF is neutral.</h2>
        <p>
          Browsers and photo pickers—commonly including iPhone web-upload flows—can remove camera metadata before a file reaches Humn. Missing device, lens, ISO, shutter, capture-time, or GPS fields are not held against the creator and do not count as evidence of AI generation.
        </p>
        <p className="method-hedge">
          When metadata is present, Humn records only what the original file actually contains. Precise GPS coordinates are not exposed publicly.
        </p>
      </section>

      <section className="style-guide-section" aria-labelledby="limits-heading">
        <div className="panel-label">What VERIFIED does not promise</div>
        <h2 id="limits-heading">Automated clearance is useful, not infallible.</h2>
        <p>
          A VERIFIED · AUTOMATED CLEAR badge means the Work cleared Humn’s automated origin detectors under the pipeline and thresholds in use at that time. Detectors can make mistakes, new generation methods can evade older models, and rephotographed or partially edited images are especially difficult.
        </p>
        <p>
          Humn therefore preserves detector results and audit evidence, uses a conservative local screen heuristic, returns uncertain cases to SELF-DECLARED, and avoids describing automated clearance as human verification.
        </p>
        <div className="actions">
          <Link className="button" href="/method/proof-records">How proof records work</Link>
          <Link className="button" href="/discover">Return to Discover</Link>
        </div>
      </section>
    </main>
  );
}
