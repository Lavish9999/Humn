import Link from 'next/link';

export function PrelaunchReferencePage({
  eyebrow,
  title,
  summary,
  includes,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  includes: readonly string[];
}) {
  return (
    <main className="shell section reference-page">
      <header className="section-head page-first-section">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          <p className="section-intro">{summary}</p>
        </div>
      </header>

      <section className="style-guide-section reference-status" aria-labelledby="prelaunch-status">
        <h2 id="prelaunch-status">Coming before launch</h2>
        <p>
          This route is reserved and linked correctly. The final reviewed copy will replace this
          notice before Humn is released publicly.
        </p>
        <div className="reference-includes">
          <p className="field-label">The finished page will cover</p>
          <ul>
            {includes.map(item => <li key={item}>{item}</li>)}
          </ul>
        </div>
        <div className="actions">
          <Link className="button" href="/about">What Humn is</Link>
          <Link className="button" href="/discover">Return to Discover</Link>
        </div>
      </section>
    </main>
  );
}
