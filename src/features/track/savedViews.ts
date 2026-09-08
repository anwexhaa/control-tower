import { EMPTY_FILTER, type Sort, type TripFilter } from "./filters";

/* Saved views and the last-used board state, persisted to localStorage.

   A controller works the same three or four slices all day — "my critical
   lanes", "everything Sharda is running", "signal loss only". Rebuilding the
   filter each morning is the kind of friction that makes people go back to
   the spreadsheet. */

const VIEWS_KEY = "ct.views";
const STATE_KEY = "ct.board";

export interface SavedView {
  id: string;
  name: string;
  filter: TripFilter;
  sort: Sort | null;
  hiddenColumns: string[];
}

export interface BoardState {
  filter: TripFilter;
  sort: Sort | null;
  hiddenColumns: string[];
  /** Height of the docked table, in pixels. */
  tableHeight: number;
}

export const DEFAULT_BOARD: BoardState = {
  filter: EMPTY_FILTER,
  sort: null,
  hiddenColumns: [],
  tableHeight: 300,
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as T) };
  } catch {
    // Private mode, blocked storage, or something wrote junk into the key.
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore — persistence is a convenience, never a requirement */
  }
}

export function loadViews(): SavedView[] {
  try {
    const raw = localStorage.getItem(VIEWS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (v): v is SavedView =>
        typeof v?.id === "string" && typeof v?.name === "string" && Boolean(v?.filter),
    );
  } catch {
    return [];
  }
}

export function persistViews(views: SavedView[]): void {
  write(VIEWS_KEY, views);
}

export function loadBoard(): BoardState {
  const board = read<BoardState>(STATE_KEY, DEFAULT_BOARD);
  // Guard against a stored filter written by an older shape.
  return { ...board, filter: { ...EMPTY_FILTER, ...board.filter } };
}

export function persistBoard(board: BoardState): void {
  write(STATE_KEY, board);
}

export function newViewId(): string {
  return `v${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}
