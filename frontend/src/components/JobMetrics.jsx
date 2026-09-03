function pad(value) {
  return String(value).padStart(2, "0");
}

export function JobMetrics({ totalSaved, appliedCount, keywordCount }) {
  return (
    <section className="metrics">
      <div>
        <span>Tracked</span>
        <strong>{pad(totalSaved)}</strong>
      </div>
      <div>
        <span>Applied</span>
        <strong>{pad(appliedCount)}</strong>
      </div>
      <div>
        <span>Keywords</span>
        <strong>{pad(keywordCount)}</strong>
      </div>
    </section>
  );
}
