export default function AccountLoading() {
  return (
    <main className="shell section page-first-section" aria-busy="true">
      <div className="media-skeleton account-heading-skeleton" />
      <div className="settings-grid">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="settings-panel" key={index}>
            <div className="media-skeleton account-panel-skeleton" />
          </div>
        ))}
      </div>
    </main>
  );
}
