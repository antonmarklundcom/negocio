/**
 * Honeypot field — hidden from real users (off-screen, not just display:none, so
 * it stays in the DOM for bots that fill everything). If it comes back filled,
 * the server drops the lead. Name is generic so bots take the bait.
 */
export function Honeypot() {
  return (
    <div aria-hidden className="absolute left-[-9999px] top-[-9999px] h-0 w-0 overflow-hidden" tabIndex={-1}>
      <label>
        No completar
        <input type="text" name="hp" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}
