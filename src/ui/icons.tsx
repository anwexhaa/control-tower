import type { ReactNode } from "react";

/* Hand-drawn icon set. No icon package — this app ships with two runtime
   dependencies (react, react-dom) and that is a deliberate part of the story. */

export type IconProps = {
  size?: number;
  className?: string;
  strokeWidth?: number;
};

function Glyph({
  size = 18,
  className,
  strokeWidth = 1.6,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/* ------------------------------------------------------------- modules --- */

export const IconProcure = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M3.2 11.4V4.6a1.4 1.4 0 0 1 1.4-1.4h6.8a1.4 1.4 0 0 1 1 .41l8.2 8.2a1.4 1.4 0 0 1 0 2l-6.8 6.8a1.4 1.4 0 0 1-2 0l-8.2-8.2a1.4 1.4 0 0 1-.4-1Z" />
    <circle cx="7.6" cy="7.6" r="1.5" />
  </Glyph>
);

export const IconExecute = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M2.8 6.4h9.6v9.8H2.8z" />
    <path d="M12.4 9.6h3.3l2.9 3.1v3.5h-6.2" />
    <circle cx="7" cy="18" r="1.8" />
    <circle cx="16.4" cy="18" r="1.8" />
    <path d="M2.8 16.2h1.5M9 16.2h1.6" />
  </Glyph>
);

export const IconTrack = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="8.6" />
    <circle cx="12" cy="12" r="4.2" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    <path d="M12 12 18.1 5.9" />
  </Glyph>
);

export const IconSettle = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M5 3h14v18l-2.8-1.7L13.4 21l-2.8-1.7L7.8 21 5 19.3Z" />
    <path d="M8.6 8.4h6.8M8.6 12.4h6.8M8.6 15.6h3.6" />
  </Glyph>
);

export const IconPulse = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M2.6 12.6h3.9l2.4-7 4.1 13.8 2.5-6.8h6.1" />
  </Glyph>
);

export const IconDecarbonize = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M11.2 20.4A7.2 7.2 0 0 1 9.9 6.4C15.6 5.3 17.1 4.7 19.1 2.2c1 2.1 2 4.3 2 8.2 0 5.6-4.8 10-9.9 10Z" />
    <path d="M2.9 21.4c0-3.1 1.9-5.5 5.2-6.2" />
  </Glyph>
);

/* ------------------------------------------------------------------ ui --- */

export const IconSearch = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="10.8" cy="10.8" r="6.8" />
    <path d="M15.8 15.8 21 21" />
  </Glyph>
);

export const IconClose = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M5.6 5.6 18.4 18.4M18.4 5.6 5.6 18.4" />
  </Glyph>
);

export const IconChevronDown = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M5.6 9 12 15.4 18.4 9" />
  </Glyph>
);

export const IconChevronRight = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M9 5.6 15.4 12 9 18.4" />
  </Glyph>
);

export const IconChevronLeft = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M15 5.6 8.6 12 15 18.4" />
  </Glyph>
);

export const IconPlay = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M7.4 4.8 19 12 7.4 19.2Z" />
  </Glyph>
);

export const IconPause = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M8.6 5v14M15.4 5v14" />
  </Glyph>
);

export const IconSun = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.4v2.2M12 19.4v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.4 12h2.2M19.4 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
  </Glyph>
);

export const IconMoon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M20.4 14.4A8.6 8.6 0 0 1 9.6 3.6a8.6 8.6 0 1 0 10.8 10.8Z" />
  </Glyph>
);

export const IconDensity = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M3.4 5.4h17.2M3.4 10.2h17.2M3.4 15h17.2M3.4 19.8h17.2" />
  </Glyph>
);

export const IconBell = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M18.2 9a6.2 6.2 0 1 0-12.4 0c0 5.4-2 7-2 7h16.4s-2-1.6-2-7" />
    <path d="M13.9 20.4a2.2 2.2 0 0 1-3.8 0" />
  </Glyph>
);

export const IconCheck = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M4.6 12.6 9.5 17.5 19.4 6.9" />
  </Glyph>
);

export const IconAlert = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M10.7 3.6 2.5 17.8a1.5 1.5 0 0 0 1.3 2.2h16.4a1.5 1.5 0 0 0 1.3-2.2L13.3 3.6a1.5 1.5 0 0 0-2.6 0Z" />
    <path d="M12 9.4v4.2M12 17.2h.01" />
  </Glyph>
);

export const IconInfo = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="8.8" />
    <path d="M12 16.4v-4.8M12 8.2h.01" />
  </Glyph>
);

export const IconFilter = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M3.4 5h17.2l-6.9 8.2v6l-3.4 1.8v-7.8Z" />
  </Glyph>
);

export const IconColumns = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M3.6 4.4h16.8v15.2H3.6z" />
    <path d="M9.2 4.4v15.2M14.8 4.4v15.2" />
  </Glyph>
);

export const IconLayers = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M12 2.8 2.6 7.6 12 12.4l9.4-4.8Z" />
    <path d="M2.6 12.6 12 17.4l9.4-4.8" />
    <path d="M2.6 17.2 12 22l9.4-4.8" />
  </Glyph>
);

export const IconUser = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="12" cy="8.2" r="3.9" />
    <path d="M4.6 20.4a7.6 7.6 0 0 1 14.8 0" />
  </Glyph>
);

export const IconArrowRight = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M4 12h15.4M13.6 6.2 19.4 12l-5.8 5.8" />
  </Glyph>
);

export const IconSpinner = ({ size = 18, className }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    aria-hidden="true"
    focusable="false"
    style={{ animation: "ct-spin 720ms linear infinite" }}
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.2" opacity="0.22" />
    <path
      d="M21 12a9 9 0 0 0-9-9"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  </svg>
);

/** The route-marker mark used as the product logo. */
export const MarkControlTower = ({ size = 22, className }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M3 18.5C6.6 18.5 6.6 8 12 8s5.4 10.5 9 10.5"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      opacity="0.45"
    />
    <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.9" />
    <circle cx="12" cy="8" r="1.15" fill="currentColor" />
  </svg>
);
