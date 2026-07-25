export default function CreatorProfileLoading() {
  return (
    <main className="shell section page-first-section" aria-busy="true">
      <div className="media-skeleton creator-profile-heading-skeleton" />
      <div className="masonry">
        {Array.from({ length: 8 }, (_, index) => (
          <div className="work-card" key={index}>
            <div className="media-skeleton creator-profile-work-skeleton" />
          </div>
        ))}
      </div>
    </main>
  );
}
