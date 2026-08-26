export function JobMetrics({ totalSaved, appliedCount, keywordCount }) {
  return (
    <section className="metrics">
      <div>
        <span>Total saved</span>
        <strong>{totalSaved}</strong>
      </div>
      <div>
        <span>Applied</span>
        <strong>{appliedCount}</strong>
      </div>
      <div>
        <span>Keywords</span>
        <strong>{keywordCount}</strong>
      </div>
    </section>
  );
}
