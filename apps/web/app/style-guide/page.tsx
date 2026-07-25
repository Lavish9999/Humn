import { ProvenanceBadge } from '../../components/provenance-badge';
import { ToggleSwitch } from '../../components/toggle-switch';
import { WorkCard } from '../../components/work-card';
import { getWorkFeed } from '../../lib/data/works';
import { pluralize } from '../../lib/pluralize';

export default async function StyleGuidePage() {
  const { items: catalogueWorks } = await getWorkFeed({ limit: 4 });
  const mosaicWorks = catalogueWorks.slice(0, 4);

  return (
    <main className="shell section style-guide-page">
      <div className="section-head page-first-section">
        <div>
          <div className="eyebrow">System / 001</div>
          <h1>Humn editorial system.</h1>
          <p className="section-intro">A compact reference for palette, typography, rules, controls, and card treatments.</p>
        </div>
      </div>

      <div className="style-guide-grid">
        <section className="style-guide-section">
          <div className="panel-label">Palette</div>
          <div className="swatches">
            <div className="swatch paper"><span className="meta">Paper</span><span>#F7F4EC</span></div>
            <div className="swatch deep"><span className="meta">Paper deep</span><span>#EFEAE0</span></div>
            <div className="swatch ink"><span className="meta">Ink</span><span>#14120E</span></div>
            <div className="swatch accent"><span className="meta">Accent</span><span>#E0492C</span></div>
            <div className="swatch alt"><span className="meta">Accent alt</span><span>#1C3F6E</span></div>
          </div>
        </section>

        <section className="style-guide-section">
          <div className="panel-label">Type hierarchy</div>
          <div className="type-sample type-display-sample">One page display headline</div>
          <div className="type-sample type-section-sample">Section heading / 20–24</div>
          <div className="type-sample type-panel-sample">Panel heading / 18–20</div>
          <div className="type-sample"><p>Body 16 / 1.55 carries most of the information. Display type is reserved for the page focal point.</p></div>
          <div className="type-sample"><span className="meta">Metadata / 12 / uppercase</span></div>
        </section>

        <section className="style-guide-section">
          <div className="panel-label">Controls</div>
          <div className="actions">
            <button className="button primary" type="button" disabled aria-disabled="true">Primary action</button>
            <button className="button" type="button" disabled aria-disabled="true">Secondary action</button>
            <button className="button alt" type="button" disabled aria-disabled="true">Alternate</button>
            <button className="button danger" type="button" disabled aria-disabled="true">Destructive</button>
          </div>
          <div className="control-specimens">
            <ToggleSwitch on={false} label="Example switch off" />
            <ToggleSwitch on label="Example switch on" />
            <button className="button danger-solid" type="button" disabled aria-disabled="true">Final delete</button>
          </div>
        </section>

        <section className="style-guide-section" id="provenance-method">
          <div className="panel-label">Provenance badges</div>
          <div className="badge-specimens">
            <ProvenanceBadge variant="verified" label="VERIFIED · 4 PROOFS" />
            <ProvenanceBadge variant="awaiting" label="AWAITING REVIEW" />
            <ProvenanceBadge variant="unverified" label="UNVERIFIED · SELF-DECLARED" />
          </div>
          <p className="muted">Only VERIFIED uses the accent color. A self-declared Work is neutral and has not been endorsed by Humn.</p>
        </section>

        <section className="style-guide-section">
          <div className="panel-label">Masonry card</div>
          <div className="style-card-preview">
            {catalogueWorks[0]
              ? <WorkCard work={catalogueWorks[0]} />
              : <span className="media-skeleton" style={{ display: 'block', aspectRatio: '4 / 5' }} />}
          </div>
        </section>

        <section className="style-guide-section">
          <div className="panel-label">Card variants</div>
          <div className="collection-grid style-collection-grid">
            <article className="collection-card">
              <div className="collection-mosaic style-guide-mosaic">
                {mosaicWorks.map(work => (
                  <span className="mosaic-cell" key={work.id}>
                    <img src={work.media_url} alt={work.alt_text} />
                  </span>
                ))}
              </div>
              <div className="collection-card-copy">
                <h3>Printed matter</h3>
                <span className="meta">{pluralize(12, 'WORK', 'WORKS')} · UPDATED 3D AGO</span>
              </div>
            </article>
            <article className="collection-card danger-zone">
              <div className="collection-card-copy">
                <div className="panel-label">Danger zone</div>
                <h3>Destructive panel</h3>
                <p className="muted">Danger uses its own ink and never competes with the primary action.</p>
                <button className="button danger" type="button" disabled aria-disabled="true">Delete</button>
              </div>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
