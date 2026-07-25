import Link from 'next/link';

export default function AboutPage() {
  return (
    <main className="shell section reference-page">
      <header className="section-head page-first-section">
        <div>
          <div className="eyebrow">About Humn</div>
          <h1>Inspiration with an origin record.</h1>
          <p className="section-intro">
            Humn is a visual discovery platform built around creator credit, process evidence,
            and provenance that is credible without pretending to be absolute.
          </p>
        </div>
      </header>

      <section className="style-guide-section reference-status">
        <h2>What the platform is for</h2>
        <p>
          People can publish work, show how it was made, organize references into Collections,
          follow creators, and inspect the evidence attached to each Work. Verified status is
          reserved for reviewed process evidence; an unsupported upload is labeled unverified
          and is not treated as a Humn endorsement.
        </p>
        <p>
          Missing metadata remains neutral. Humn does not accuse creators from appearance alone,
          and it does not display AI-likelihood percentages or detector verdicts.
        </p>
        <div className="actions">
          <Link className="button primary" href="/discover">Explore Discover</Link>
          <Link className="button" href="/method/origin-status">Read the origin-status outline</Link>
        </div>
      </section>
    </main>
  );
}
