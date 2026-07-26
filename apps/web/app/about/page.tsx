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
          follow creators, and inspect the evidence attached to each Work. An automated origin
          check passes only when two independent detectors clear the Work and every configured
          integrity guard is clean. Unsupported or uncertain uploads remain CREATOR DECLARED.
        </p>
        <p>
          Missing metadata remains neutral. Humn does not claim that an automated check proves
          human authorship, originality, or ownership. Public pages summarize the outcome while
          detailed vendor scores remain private to the creator and authorized reviewers.
        </p>
        <div className="actions">
          <Link className="button primary" href="/discover">Explore Discover</Link>
          <Link className="button" href="/method/origin-status">Read how origin checks work</Link>
        </div>
      </section>
    </main>
  );
}
