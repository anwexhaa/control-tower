import { cx } from "../lib/cx";

const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** Renders `mod+K` as ⌘K or Ctrl K depending on the platform. */
export function KeyHint({
  keys,
  className,
}: {
  keys: string;
  className?: string;
}) {
  const parts = keys.split("+").map((k) => {
    const key = k.trim().toLowerCase();
    if (key === "mod") return isMac ? "⌘" : "Ctrl";
    if (key === "shift") return isMac ? "⇧" : "Shift";
    if (key === "alt") return isMac ? "⌥" : "Alt";
    if (key === "enter") return "↵";
    if (key === "esc") return "Esc";
    if (key === "up") return "↑";
    if (key === "down") return "↓";
    return k.trim().toUpperCase();
  });

  return (
    <kbd
      className={cx(
        "inline-flex items-center gap-0.5 rounded-xs border border-line bg-sunken",
        "px-1 py-px font-mono text-[10.5px] leading-[15px] text-ink-mute",
        className,
      )}
    >
      {parts.map((p, i) => (
        <span key={i}>{p}</span>
      ))}
    </kbd>
  );
}
