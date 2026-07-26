import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Proof records — Humn',
  description: 'How Humn records original-file evidence, metadata, hashes, process context, and automated-review history.',
};

export default function ProofRecordsPage() {
  return (
    <main className="shell section reference-page">
      <header className="section-head page-first-section">
        <div>
          <div className="eyebrow">Provenance &amp; method</div>
          <h1>Proof records.</h1>
          <p className="section-intro">
            A proof record preserves the evidence attached to a Work: what file arrived, what the file contained, what the creator supplied, and what Humn&apos;s review systems concluded. It is evidence—not an absolute certificate of authorship.
          </p>
        </div>
      </header>

      <section className="style-guide-section" aria-labelledby="record-purpose">
        <div className="panel-label">Purpose</div>
        <h2 id="record-purpose">A readable trail, not a magic stamp.</h2>
        <p>
          Humn keeps separate records for the original upload, technical file signals, creator-authored process context, and review activity. Keeping those sources separate matters: a camera field is not the same thing as a creator statement, and an automated detector score is not the same thing as human authorship.
        </p>
        <p className="method-hedge">
          Public badges summarize the review state. They do not expose private account data, precise location, or every raw detector response.
        </p>
      </section>

      <section className="style-guide-section" aria-labelledby="file-record">
        <div className="panel-label">Original-file record</div>
        <h2 id="file-record">The uploaded bytes are the reference point.</h2>
        <div className="reference-includes">
          <ul>
            <li>The original file is stored without a browser canvas re-encode or cosmetic transformation.</li>
            <li>A cryptographic hash identifies the exact uploaded bytes and supports duplicate-file checks.</li>
            <li>Upload time, file type, dimensions, and size are recorded as technical facts.</li>
            <li>Integrity checks compare the file Humn received with the file held for review.</li>
          </ul>
        </div>
        <p className="method-hedge">
          A matching hash proves that two byte sequences match. It does not prove who created the image or whether earlier versions existed.
        </p>
      </section>

      <section className="style-guide-section" aria-labelledby="metadata-record">
        <div className="panel-label">Metadata and credentials</div>
        <h2 id="metadata-record">Present metadata is recorded. Missing metadata is neutral.</h2>
        <div className="reference-includes">
          <ul>
            <li>Available EXIF fields may include device, lens, orientation, exposure, and capture-time information.</li>
            <li>Embedded Content Credentials or C2PA assertions are recorded when the file contains them.</li>
            <li>Exact duplicate hashes can identify a file already known to Humn.</li>
            <li>Precise GPS coordinates are not displayed publicly.</li>
          </ul>
        </div>
        <p>
          Browsers and photo pickers—especially common iPhone web-upload paths—can remove EXIF before upload. Humn does not count missing EXIF as evidence of AI generation, deception, or creator fault.
        </p>
      </section>

      <section className="style-guide-section" aria-labelledby="process-record">
        <div className="panel-label">Creator process</div>
        <h2 id="process-record">Proof Stories provide context from the creator.</h2>
        <p>
          A creator can attach process notes and supporting material to explain how a Work developed. Humn records the author, timing, and relationship to the Work so reviewers and viewers can understand the claim in context.
        </p>
        <p className="method-hedge">
          Creator-authored process evidence is supporting context. Unless another signal independently confirms it, Humn does not present the creator&apos;s statement as independently proven fact.
        </p>
      </section>

      <section className="style-guide-section" aria-labelledby="review-record">
        <div className="panel-label">Review history</div>
        <h2 id="review-record">Automated runs leave an audit trail.</h2>
        <p>
          When automated origin review runs, Humn records the participating detectors, normalized scores, confidence, decision reason, timestamps, and status changes. Strong synthetic signals can reject a submission; disagreement, unavailable checks, low confidence, duplicate concerns, or suspected screen rephotography can escalate it.
        </p>
        <p>
          VERIFIED · AUTOMATED CLEAR means the Work cleared Humn&apos;s automated origin detectors under the thresholds in use at that time. It does not mean a person reviewed the Work, and it does not guarantee authorship, originality, ownership, or perfect detector accuracy.
        </p>
      </section>

      <section className="style-guide-section" aria-labelledby="record-limits">
        <div className="panel-label">Limits</div>
        <h2 id="record-limits">What a proof record cannot settle by itself.</h2>
        <div className="reference-includes">
          <ul>
            <li>Who legally owns every element in the Work.</li>
            <li>Whether all creative decisions were made without assistance.</li>
            <li>Whether a camera image was staged, edited, printed, or photographed from a display.</li>
            <li>Whether a detector will remain accurate against future generation methods.</li>
          </ul>
        </div>
        <nav className="actions" aria-label="Related provenance guides">
          <Link className="button" href="/method/origin-status">How verification works</Link>
          <Link className="button" href="/method/moderation-standard">Moderation standard</Link>
        </nav>
      </section>
    </main>
  );
}
