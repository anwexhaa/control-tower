import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/* A polite live region, so a screen reader hears what a sighted controller
   sees flash red.

   Polite rather than assertive on purpose: a critical exception is urgent for
   the fleet, not urgent enough to cut across whatever the user is currently
   reading. Assertive here would interrupt someone mid-sentence every time a
   truck stopped. */

interface AnnouncerApi {
  announce: (message: string) => void;
}

const AnnouncerContext = createContext<AnnouncerApi | null>(null);

export function useAnnouncer(): AnnouncerApi {
  const ctx = useContext(AnnouncerContext);
  // Announcing is a nicety; a component outside the provider should not crash.
  return ctx ?? { announce: () => {} };
}

export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const timer = useRef(0);

  const announce = useCallback((next: string) => {
    // Clear first: repeating the same string into a live region says nothing,
    // because the node did not change.
    setMessage("");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(next), 60);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const api = useMemo(() => ({ announce }), [announce]);

  return (
    <AnnouncerContext.Provider value={api}>
      {children}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {message}
      </div>
    </AnnouncerContext.Provider>
  );
}
