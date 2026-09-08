import { useSyncExternalStore, type MouseEvent, type ReactNode } from "react";

/* A ~90-line router. Three route shapes do not justify a dependency, and
   keeping the runtime at react + react-dom is part of what this build argues. */

export type Params = Record<string, string>;

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("popstate", onChange);
  };
}

function getSnapshot() {
  return window.location.pathname;
}

export function useLocation(): string {
  return useSyncExternalStore(subscribe, getSnapshot, () => "/");
}

export function navigate(to: string, options: { replace?: boolean } = {}): void {
  if (to === window.location.pathname) return;
  if (options.replace) window.history.replaceState(null, "", to);
  else window.history.pushState(null, "", to);
  emit();
}

/**
 * Match a path against a pattern. `:name` captures one segment.
 * Returns the captured params, or null when the pattern does not apply.
 */
export function matchPath(pattern: string, path: string): Params | null {
  const p = pattern.split("/").filter(Boolean);
  const a = path.split("/").filter(Boolean);
  if (p.length !== a.length) return null;

  const params: Params = {};
  for (let i = 0; i < p.length; i++) {
    const seg = p[i];
    if (seg.startsWith(":")) params[seg.slice(1)] = decodeURIComponent(a[i]);
    else if (seg !== a[i]) return null;
  }
  return params;
}

/** True when `path` is at or below `base` — used for nav highlighting. */
export function isActive(base: string, path: string): boolean {
  return path === base || path.startsWith(`${base}/`);
}

type LinkProps = {
  to: string;
  children: ReactNode;
  className?: string;
  replace?: boolean;
  title?: string;
  "aria-current"?: "page" | boolean;
  "aria-label"?: string;
};

export function Link({ to, children, replace, ...rest }: LinkProps) {
  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    // Let the browser handle new-tab, download and modified clicks.
    if (e.defaultPrevented) return;
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to, { replace });
  }
  return (
    <a href={to} onClick={onClick} {...rest}>
      {children}
    </a>
  );
}
