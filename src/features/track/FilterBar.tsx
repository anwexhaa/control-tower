import { useState } from "react";
import { num } from "../../domain/format";
import { cx } from "../../lib/cx";
import {
  Button,
  Chip,
  IconButton,
  KeyHint,
  Modal,
  SearchInput,
  Toggle,
  Tooltip,
} from "../../ui";
import { IconClose, IconColumns, IconFilter, IconLayers } from "../../ui/icons";
import { COLUMNS } from "./TripTable";
import {
  EMPTY_FILTER,
  countActiveDimensions,
  describeFilter,
  isFilterActive,
  type TripFilter,
} from "./filters";
import { newViewId, type SavedView } from "./savedViews";

/* The one place the board's shape is set, and the one place it is shown.

   Every active dimension is a removable chip, so there is never a filter in
   force that the user cannot see — the failure mode with faceted filtering is
   always "why is this table empty", and the answer should be on screen. */

export function FilterBar({
  filter,
  onFilter,
  shown,
  total,
  hiddenColumns,
  onHiddenColumns,
  views,
  onViews,
  onOpenPalette,
}: {
  filter: TripFilter;
  onFilter: (next: TripFilter) => void;
  shown: number;
  total: number;
  hiddenColumns: string[];
  onHiddenColumns: (next: string[]) => void;
  views: SavedView[];
  onViews: (next: SavedView[]) => void;
  onOpenPalette: () => void;
}) {
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");

  const chips = describeFilter(filter);
  const active = isFilterActive(filter);

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line bg-panel px-3 py-2">
      <SearchInput
        value={filter.query}
        onChange={(e) => onFilter({ ...filter, query: e.currentTarget.value })}
        placeholder="Filter by LR, vehicle, transporter, lane…"
        aria-label="Filter trips"
        className="w-[300px]"
      />

      <Tooltip label="Jump to a trip, transporter or view" side="bottom">
        <Button size="sm" variant="secondary" onClick={onOpenPalette}>
          <IconFilter size={13} />
          <KeyHint keys="mod+K" className="ml-1" />
        </Button>
      </Tooltip>

      <div className="h-5 w-px bg-line" />

      {/* active dimensions */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {chips.length === 0 ? (
          <span className="text-[11.5px] text-ink-faint">No filter — whole network</span>
        ) : (
          chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => onFilter(chip.clear(filter))}
              className="group/chip inline-flex items-center gap-1 rounded-xs border border-accent-line bg-accent-soft px-1.5 py-px text-[11px] text-accent transition-colors hover:border-accent"
            >
              {chip.label}
              <IconClose size={10} className="opacity-60 group-hover/chip:opacity-100" />
            </button>
          ))
        )}
      </div>

      <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-mute">
        {active ? `${num(shown)} / ${num(total)}` : `${num(total)} trips`}
      </span>

      {active && (
        <Button size="sm" variant="ghost" onClick={() => onFilter(EMPTY_FILTER)}>
          Clear
        </Button>
      )}

      <div className="h-5 w-px bg-line" />

      {/* saved views */}
      <select
        aria-label="Saved views"
        value=""
        onChange={(e) => {
          const view = views.find((v) => v.id === e.currentTarget.value);
          if (view) {
            onFilter(view.filter);
            onHiddenColumns(view.hiddenColumns);
          }
        }}
        className="h-7 rounded-sm border border-line bg-panel px-2 text-[12px] text-ink-soft hover:border-line-strong"
      >
        <option value="">
          {views.length ? `Views (${views.length})` : "Views"}
        </option>
        {views.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>

      <Tooltip label="Save the current filter as a view" side="bottom">
        <IconButton
          label="Save view"
          size="sm"
          disabled={!active}
          onClick={() => {
            setName("");
            setSaveOpen(true);
          }}
        >
          <IconLayers size={15} />
        </IconButton>
      </Tooltip>

      <Tooltip label="Show or hide columns" side="bottom">
        <IconButton
          label="Columns"
          size="sm"
          active={hiddenColumns.length > 0}
          onClick={() => setColumnsOpen(true)}
        >
          <IconColumns size={15} />
        </IconButton>
      </Tooltip>

      {/* ------------------------------------------------------------ modals */}

      <Modal
        open={columnsOpen}
        onClose={() => setColumnsOpen(false)}
        title="Columns"
        footer={
          <>
            <Button variant="ghost" onClick={() => onHiddenColumns([])}>
              Show all
            </Button>
            <Button variant="primary" onClick={() => setColumnsOpen(false)}>
              Done
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          {COLUMNS.map((c) => {
            const visible = !hiddenColumns.includes(c.key);
            return (
              <label key={c.key} className="flex cursor-pointer items-center gap-2.5">
                <Toggle
                  checked={visible}
                  label={c.label}
                  onChange={(next) =>
                    onHiddenColumns(
                      next
                        ? hiddenColumns.filter((k) => k !== c.key)
                        : [...hiddenColumns, c.key],
                    )
                  }
                />
                <span className="text-[13px] text-ink-soft select-none">{c.label}</span>
              </label>
            );
          })}
        </div>
      </Modal>

      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="Save view"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!name.trim()}
              onClick={() => {
                onViews([
                  ...views,
                  {
                    id: newViewId(),
                    name: name.trim(),
                    filter,
                    sort: null,
                    hiddenColumns,
                  },
                ]);
                setSaveOpen(false);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] font-medium tracking-[0.1em] text-ink-mute uppercase">
              Name
            </span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder="Critical lanes, west zone"
              className="h-8.5 rounded-sm border border-line bg-panel px-2.5 text-[13px] text-ink placeholder:text-ink-faint focus:border-accent"
            />
          </label>

          <div className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <Chip key={c.key} tone="neutral">
                {c.label}
              </Chip>
            ))}
          </div>

          {views.length > 0 && (
            <div className="border-t border-line-soft pt-3">
              <p className="mb-1.5 text-[10.5px] font-medium tracking-[0.1em] text-ink-mute uppercase">
                Saved ({countActiveDimensions(filter)} dimensions in this one)
              </p>
              <ul className="flex flex-col gap-1">
                {views.map((v) => (
                  <li key={v.id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-soft">
                      {v.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => onViews(views.filter((x) => x.id !== v.id))}
                      className={cx(
                        "shrink-0 rounded-xs px-1.5 py-0.5 text-[11px] text-ink-mute",
                        "transition-colors hover:bg-crit-soft hover:text-crit",
                      )}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
