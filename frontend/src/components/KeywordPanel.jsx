import { Plus, Search, X } from "lucide-react";

export function KeywordPanel({
  keywords,
  newKeyword,
  selectedKeyword,
  onNewKeywordChange,
  onAddKeyword,
  onRemoveKeyword,
  onSelectKeyword,
}) {
  return (
    <section className="keyword-panel">
      <form onSubmit={onAddKeyword}>
        <Search size={18} />
        <input
          value={newKeyword}
          onChange={(event) => onNewKeywordChange(event.target.value)}
          placeholder="Add a job title keyword"
        />
        <button type="submit" title="Add keyword">
          <Plus size={18} />
          Add
        </button>
      </form>

      <div className="keyword-chips">
        <button
          type="button"
          className={!selectedKeyword ? "active" : ""}
          onClick={() => onSelectKeyword("")}
        >
          All
        </button>

        {keywords.map((keyword) => (
          <span
            className={selectedKeyword === keyword.value ? "keyword-chip active" : "keyword-chip"}
            key={keyword._id}
          >
            <button type="button" onClick={() => onSelectKeyword(keyword.value)}>
              {keyword.value}
            </button>
            <button
              type="button"
              onClick={() => onRemoveKeyword(keyword._id, keyword.value)}
              title={`Remove ${keyword.value}`}
            >
              <X size={14} />
            </button>
          </span>
        ))}
      </div>
    </section>
  );
}
