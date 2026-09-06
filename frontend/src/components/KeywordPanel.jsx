import { Plus, Search, X } from "lucide-react";
import { useState } from "react";

export function KeywordPanel({
  usage,
  atLimit,
  keywords,
  newKeyword,
  selectedKeyword,
  onNewKeywordChange,
  onAddKeyword,
  onRemoveKeyword,
  onSelectKeyword,
}) {
  const [isAdding, setIsAdding] = useState(false);

  async function handleAdd(event) {
    await onAddKeyword(event);
    setIsAdding(false);
  }

  return (
    <section className="keyword-panel">
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

      <div className="keyword-add-row">
        {usage && <span className="keyword-usage">{usage} keywords</span>}
        {isAdding ? (
          <form onSubmit={handleAdd}>
            <Search size={16} />
            <input
              autoFocus
              value={newKeyword}
              onChange={(event) => onNewKeywordChange(event.target.value)}
              placeholder="Add a job title to keyword"
            />
            <button type="submit" title="Add keyword">
              <Plus size={16} />
              Keyword
            </button>
            <button
              type="button"
              className="kw-cancel"
              onClick={() => setIsAdding(false)}
              title="Cancel"
            >
              <X size={16} />
            </button>
          </form>
        ) : (
          <button
            type="button"
            className="kw-add"
            onClick={() => setIsAdding(true)}
            disabled={atLimit}
            title={atLimit ? "Your plan's keyword limit is reached" : "Add a keyword"}
          >
            <Plus size={14} />
            New keyword
          </button>
        )}
      </div>
    </section>
  );
}
