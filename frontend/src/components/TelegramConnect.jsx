import { Check, Copy, ExternalLink, Loader2, Send, Unlink } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

export function TelegramConnect() {
  const { user, setUser, apiFetch } = useAuth();
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const pollRef = useRef(null);

  const connected = Boolean(user?.telegramId);

  // While a code is on screen, watch for the bot to confirm the link. The page has
  // no other way to learn that it worked — the confirmation happens in Telegram.
  useEffect(() => {
    if (!link || connected) return undefined;

    pollRef.current = setInterval(async () => {
      try {
        const data = await apiFetch("/api/auth/me");
        if (data.user?.telegramId) {
          setUser(data.user);
          setLink(null);
        }
      } catch {
        // A failed poll is not worth surfacing; the next tick retries.
      }
    }, 3000);

    return () => clearInterval(pollRef.current);
  }, [link, connected, apiFetch, setUser]);

  // Stop polling once the code expires so an abandoned panel does not poll forever.
  useEffect(() => {
    if (!link) return undefined;

    const msLeft = new Date(link.expiresAt).getTime() - Date.now();
    const timer = setTimeout(() => setLink(null), Math.max(msLeft, 0));

    return () => clearTimeout(timer);
  }, [link]);

  async function startLink() {
    setBusy(true);
    setError("");
    try {
      // Minted before the anchor renders: a popup opened after an await gets
      // blocked by Safari and Firefox, so the user clicks a real link instead.
      setLink(await apiFetch("/api/auth/telegram/link", { method: "POST" }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError("");
    try {
      const data = await apiFetch("/api/auth/telegram/link", { method: "DELETE" });
      setUser(data.user);
      setLink(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(link.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy — select the code and copy it manually.");
    }
  }

  if (connected) {
    return (
      <div className="telegram-connect telegram-connect--linked">
        <div className="telegram-connect__status">
          <Check size={18} />
          <div>
            <strong>Telegram connected</strong>
            <p>Job alerts are delivered to your Telegram chat.</p>
          </div>
        </div>
        <button type="button" onClick={disconnect} disabled={busy}>
          <Unlink size={16} />
          {busy ? "Disconnecting" : "Disconnect"}
        </button>
      </div>
    );
  }

  return (
    <div className="telegram-connect">
      {!link ? (
        <>
          <div className="telegram-connect__status">
            <Send size={18} />
            <div>
              <strong>Telegram not connected</strong>
              <p>Connect Telegram to receive your job alerts.</p>
            </div>
          </div>
          <button type="button" onClick={startLink} disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
            {busy ? "Preparing" : "Connect Telegram"}
          </button>
        </>
      ) : (
        <div className="telegram-connect__steps">
          {link.deepLink && (
            <a
              className="telegram-connect__open"
              href={link.deepLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={16} />
              Open Telegram and press Start
            </a>
          )}

          <p className="telegram-connect__or">
            Already using the bot, or on a device without Telegram? Send this code to{" "}
            <strong>@{link.botUsername || "the bot"}</strong>:
          </p>

          <div className="telegram-connect__code">
            <code>{link.code}</code>
            <button type="button" onClick={copyCode}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <p className="telegram-connect__hint">
            Waiting for confirmation… this code expires in{" "}
            {Math.max(
              1,
              Math.round((new Date(link.expiresAt).getTime() - Date.now()) / 60000)
            )}{" "}
            minutes.
          </p>
        </div>
      )}

      {error && <p className="telegram-connect__error">{error}</p>}
    </div>
  );
}
