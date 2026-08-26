export function LoaderPopup({ message }) {
  if (!message) return null;

  return (
    <div className="loader-backdrop" role="status" aria-live="polite" aria-label={message}>
      <div className="loader-popup">
        <span className="loader-spinner" aria-hidden="true" />
        <strong>{message}</strong>
        <p>Please wait</p>
      </div>
    </div>
  );
}
