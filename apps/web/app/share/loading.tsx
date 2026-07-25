export default function ShareLoading() {
  return (
    <main className="shell report-page" aria-busy="true">
      <section className="form-card page-first-section share-work-card">
        <header className="form-header">
          <div className="meta">Creator upload</div>
          <h3>Share your work</h3>
        </header>
        <div className="form-body">
          <div className="share-preview share-preview-loading"><span className="media-skeleton" /></div>
          <div className="feed-skeleton-copy" />
          <div className="feed-skeleton-copy" />
          <div className="feed-skeleton-copy" />
        </div>
      </section>
    </main>
  );
}
