import { useEffect, useState } from "react";
import { KeyHint, Modal } from "../ui";

/* Every shortcut in one place, on "?".

   Undiscoverable shortcuts are the same as no shortcuts. The sheet is also the
   honest record of what is actually bound — if a binding is not on this list,
   it does not exist. */

const GROUPS: Array<{ title: string; items: Array<[string, string]> }> = [
  {
    title: "Anywhere",
    items: [
      ["mod+K", "Open the command palette"],
      ["?", "Show this sheet"],
      ["esc", "Close the topmost panel or clear the selection"],
    ],
  },
  {
    title: "Map",
    items: [
      ["up", "Pan north — hold shift to pan further"],
      ["down", "Pan south"],
      ["left", "Pan west"],
      ["right", "Pan east"],
      ["+", "Zoom in"],
      ["-", "Zoom out"],
      ["0", "Reset to the whole network"],
    ],
  },
  {
    title: "Trips table",
    items: [
      ["up", "Previous trip"],
      ["down", "Next trip"],
      ["home", "First trip"],
      ["end", "Last trip"],
      ["enter", "Open the trip drawer"],
    ],
  },
  {
    title: "Exception queue",
    items: [
      ["up", "Previous exception"],
      ["down", "Next exception"],
      ["enter", "Select the trip it belongs to"],
    ],
  },
];

export function ShortcutSheet() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "?") return;
      // Never steal the key from somebody typing a question mark.
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) return;
      e.preventDefault();
      setOpen((v) => !v);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="Keyboard shortcuts"
      width={520}
    >
      <div className="flex flex-col gap-4">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h3 className="mb-1.5 text-[10.5px] font-medium tracking-[0.1em] text-ink-mute uppercase">
              {group.title}
            </h3>
            <dl className="flex flex-col gap-1">
              {group.items.map(([keys, description]) => (
                <div key={keys} className="flex items-baseline gap-3">
                  <dt className="w-[76px] shrink-0">
                    <KeyHint keys={keys} />
                  </dt>
                  <dd className="text-[12.5px] text-ink-soft">{description}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}

        <p className="border-t border-line-soft pt-3 text-[11.5px] text-ink-mute">
          Every surface is reachable with a keyboard. The map also has a list view
          for screen readers, and the trips table below it lists the same vehicles.
        </p>
      </div>
    </Modal>
  );
}
