import { useEffect, useState } from "react";

/* Whether the viewer has asked for less movement.

   The CSS rule in tokens.css already flattens transitions and keyframes, but
   the canvas draws its own animation and has to be told. Note this stops the
   *decoration* — pulsing halos on fresh criticals — and never the simulation:
   somebody who dislikes motion still needs the trucks to move. */

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (!window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
