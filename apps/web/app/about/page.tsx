import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About Humn',
  description: 'Humn is a visual discovery platform built around creator credit, process evidence, and honest automated origin labels.',
};

export default function AboutPage() {
  return (
    <main className="shell section reference-page">
      <header className="section-head page-first-section">
        <div>
          <div className="eyebrow">About Humn</div>
          <h1>Inspiration with an origin record.</h1>
          <p className="section-intro">
            Humn is a visual discovery platform built around creator credit, process evidence,
            and provenance that is useful without pretending to be absolute.
          </p>
        </div>
      </header>

      <section className="style-guide-section reference-status">
        <div className="panel-label">What the platform is for</div>
        <h2>Discover the work. See the record behind it.</h2>
        <p>
          People can publish Works, explain how they were made, organize references into Collections,
          follow creators, and inspect the evidence attached to each Work. Humn keeps creator-authored
          process context separate from technical file signals and automated detector results so viewers
          can understand what each piece of evidence actually establishes.
        </p>
        <p>
          VERIFIED · AUTOMATED CLEAR means a Work cleared Humn&apos;s automated origin detectors under the
          thresholds in use at that time. It is not human-reviewed and it is not a guarantee of authorship,
          originality, copyright ownership, or perfect detector accuracy. UNVERIFIED · SELF-DECLARED is a
          neutral creator claim, not an accusation.
        </p>
        <p>
          Missing camera metadata remains neutral. Humn does not punish creators because a browser or
          iPhone upload removed EXIF, and it does not treat visual appearance alone as proof. Uncertain,
          conflicting, unavailable, or screen-rephotograph signals can be escalated rather than silently passed.
        </p>
        <div className="actions">
          <Link className="button primary" href="/discover">Explore Discover</Link>
          <Link className="button" href="/method/origin-status">How verification works</Link>
          <Link className="button" href="/method/proof-records">Read about proof records</Link>
        </div>
      </section>
    </main>
  );
}
