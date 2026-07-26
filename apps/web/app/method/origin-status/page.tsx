import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AUTOMATED_VERIFIED_EXPLANATION,
  ProvenanceBadge,
} from '../../../components/provenance-badge';

export const metadata: Metadata = {
  title: 'How origin checks work — Humn',
  description: 'A plain-language guide to Humn’s creator-declared, processing, and origin-check-passed labels.',
};

const verificationStates = [
  {
    variant: 'unverified' as const,
    label: 'CREATOR DECLARED',
    heading: 'The creator made the origin claim.',
    body: 'The Work was submitted as human-made, but Humn has not cleared it through the automated origin checks. This label is neutral: it is not an accusation, endorsement, or automated finding. Uncertain completed checks return to this state instead of waiting indefinitely.',
  },
  {
    variant: 'awaiting' as const,
    label: 'ORIGIN CHECK IN PROGRESS',
    heading: 'The automated checks are actively processing.',
    body: 'Humn has queued or started its detector and provenance checks. This is a temporary processing state. When the run completes, the Work passes, fails, or returns to CREATOR DECLARED.',
  },
  {
    variant: 'verified' as const,
    label: 'ORIGIN CHECK PASSED',
    heading: AUTOMATED_VERIFIED_EXPLANATION,
    body: 'Two independent content detectors cleared the Work under Humn’s configured thresholds, required AI, deepfake, and confidence results were present, and no blocking integrity or local screen-rephotograph signal was present. This is an automated result. It is not human-reviewed and it is not a guarantee of authorship, originality, copyright ownership, or perfect detector accuracy.',
  },
];

export default function OriginStatusPage() {
  return (
    <main className="shell section reference-page">
      <header className="section-head page-first-section">
        <div>
          <div className="eyebrow">Provenance &amp; method</div>
          <h1>How origin checks work.</h1>
          <p className="section-intro">
            Humn labels what its automated review system has actually established. The labels describe the state of an origin check; they do not claim certainty where none exists.
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
            <li>Independent AI-generation and deepfake detector results.</li>
            <li>Original-file integrity, duplicate hashes, Content Credentials, and available camera metadata.</li>
            <li>Partial screen-rephotograph heuristics such as moiré, display-like borders, and reflection patterns.</li>
            <li>Process evidence supplied by the creator as supporting context.</li>
          </ul>
        </div>
        <p className="method-hedge">
          Every score is a signal, not a verdict by itself. Strong synthetic signals can fail a submission. Disagreement, low confidence, unavailable checks, incomplete results, duplicate concerns, or suspected screen rephotography do not auto-pass; the Work returns to CREATOR DECLARED instead.
        </p>
      </section>

      <section className="style-guide-section" aria-labelledby="public-details-heading">
        <div className="panel-label">Public and private details</div>
        <h2 id="public-details-heading">The outcome is public. Vendor scoring is not.</h2>
        <p>
          Public Work pages show the origin-check state, pipeline version, evidence digest, and a plain-language limitation. Exact provider identities, model versions, thresholds, confidence values, and detector scores remain available only to the creator and authorized reviewers.
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
        <div className="panel-label">What ORIGIN CHECK PASSED does not promise</div>
        <h2 id="limits-heading">Automated clearance is useful, not infallible.</h2>
        <p>
          ORIGIN CHECK PASSED means the Work cleared Humn’s automated origin checks under the pipeline and thresholds in use at that time. Detectors can make mistakes, new generation methods can evade older models, and rephotographed or partially edited images are especially difficult.
        </p>
        <p>
          Humn therefore preserves detector results and audit evidence, uses a conservative local screen heuristic, returns uncertain cases to CREATOR DECLARED, and avoids describing automated clearance as proof of human authorship.
        </p>
        <div className="actions">
          <Link className="button" href="/method/proof-records">How proof records work</Link>
          <Link className="button" href="/discover">Return to Discover</Link>
        </div>
      </section>
    </main>
  );
}
