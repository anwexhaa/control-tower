import { useCallback, useEffect, useState } from "react";

/* Viewing preferences that outlive a session. Both are written to the root
   element as data attributes, which is what tokens.css keys off. */

export type Theme = "dark" | "light";
export type Density = "comfortable" | "compact";

const THEME_KEY = "ct.theme";
const DENSITY_KEY = "ct.density";

/** Dark by default: this is an operations console, not a document. */
function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* private mode, blocked storage — fall through to the default */
  }
  return "dark";
}

function readDensity(): Density {
  try {
    const stored = localStorage.getItem(DENSITY_KEY);
    if (stored === "compact" || stored === "comfortable") return stored;
  } catch {
    /* ignore */
  }
  return "comfortable";
}

/** Applied before React mounts so the first paint is already correct. */
export function applyStoredPrefs(): void {
  const root = document.documentElement;
  root.dataset.theme = readTheme();
  root.dataset.density = readDensity();
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const toggle = useCallback(
    () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    [],
  );
  return { theme, setTheme, toggle };
}

export function useDensity() {
  const [density, setDensity] = useState<Density>(readDensity);

  useEffect(() => {
    document.documentElement.dataset.density = density;
    try {
      localStorage.setItem(DENSITY_KEY, density);
    } catch {
      /* ignore */
    }
  }, [density]);

  const toggle = useCallback(
    () => setDensity((d) => (d === "compact" ? "comfortable" : "compact")),
    [],
  );
  return { density, setDensity, toggle };
}
