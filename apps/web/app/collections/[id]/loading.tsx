export default function CollectionDetailLoading() {
  return (
    <main className="section collection-detail-page">
      <div className="shell page-first-section">
        <div className="media-skeleton collection-detail-heading-skeleton" />
      </div>
      <div className="shell masonry-shell">
        <div className="masonry">
          {Array.from({ length: 8 }, (_, index) => (
            <div className="work-card" key={index}>
              <div className="media-skeleton collection-work-skeleton" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
