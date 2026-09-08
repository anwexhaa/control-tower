import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  Chip,
  Drawer,
  EmptyState,
  IconButton,
  KeyHint,
  Metric,
  Modal,
  Panel,
  PanelBody,
  PanelHeader,
  SearchInput,
  SegmentedControl,
  Select,
  SeverityDot,
  Skeleton,
  StatusPill,
  Table,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  Toggle,
  Tooltip,
  TR,
  useToast,
} from "../../ui";
import type { Severity, Tone } from "../../ui";
import { IconAlert, IconArrowRight, IconFilter, IconTrack } from "../../ui/icons";

/* The living reference for the token system. It exists so the phase-0 exit
   criteria are checkable by eye: every primitive, every state, both themes. */

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <Panel className="mb-3">
      <PanelHeader title={title} subtitle={note} />
      <PanelBody scroll={false}>{children}</PanelBody>
    </Panel>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line-soft py-2.5 last:border-0">
      <span className="w-[132px] shrink-0 font-mono text-[10.5px] tracking-[0.08em] text-ink-faint uppercase">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

const GROUNDS = ["base", "sunken", "panel", "raised", "hover", "active"] as const;
const SEMANTIC = ["ok", "info", "warn", "crit", "idle"] as const;
const TONES: Tone[] = ["neutral", "ok", "info", "warn", "crit"];
const SEVERITIES: Severity[] = ["low", "medium", "high", "critical"];

export function DesignSystem() {
  const [drawer, setDrawer] = useState(false);
  const [modal, setModal] = useState(false);
  const [seg, setSeg] = useState("all");
  const [on, setOn] = useState(true);
  const toast = useToast();

  return (
    <div className="h-full overflow-auto p-3">
      <div className="mx-auto max-w-[1080px]">
        {/* ------------------------------------------------------ colour --- */}
        <Section
          title="Colour"
          note="Brand blue drives interaction. The semantic set describes freight condition and nothing else."
        >
          <Row label="Grounds">
            {GROUNDS.map((g) => (
              <div key={g} className="text-center">
                <div
                  className="h-10 w-16 rounded-sm border border-line"
                  style={{ background: `var(--color-${g})` }}
                />
                <div className="mt-1 font-mono text-[9.5px] text-ink-faint">{g}</div>
              </div>
            ))}
          </Row>
          <Row label="Brand">
            {["accent", "accent-hover", "accent-press", "accent-soft"].map((c) => (
              <div key={c} className="text-center">
                <div
                  className="h-10 w-16 rounded-sm border border-line"
                  style={{ background: `var(--color-${c})` }}
                />
                <div className="mt-1 font-mono text-[9.5px] text-ink-faint">
                  {c.replace("accent", "acc")}
                </div>
              </div>
            ))}
          </Row>
          <Row label="Semantic">
            {SEMANTIC.map((c) => (
              <div key={c} className="text-center">
                <div
                  className="h-10 w-16 rounded-sm border border-line"
                  style={{ background: `var(--color-${c})` }}
                />
                <div className="mt-1 font-mono text-[9.5px] text-ink-faint">{c}</div>
              </div>
            ))}
          </Row>
          <Row label="Ink">
            {["ink", "ink-soft", "ink-mute", "ink-faint"].map((c) => (
              <span
                key={c}
                className="text-[13px] font-medium"
                style={{ color: `var(--color-${c})` }}
              >
                {c}
              </span>
            ))}
          </Row>
        </Section>

        {/* -------------------------------------------------- typography --- */}
        <Section
          title="Typography"
          note="IBM Plex Sans for interface, IBM Plex Mono for anything an operator reads back over a phone line."
        >
          <div className="flex flex-col gap-2 py-1">
            <div className="text-[22px] leading-tight font-semibold tracking-tight text-ink">
              Metric figure — 1,204
            </div>
            <div className="text-[14px] font-semibold text-ink">
              Section heading — Exception queue
            </div>
            <div className="text-[13.5px] text-ink-soft">
              Body — Trip TRP-88214 is projected to miss its commit by 4h 20m.
            </div>
            <div className="text-[11px] tracking-[0.1em] text-ink-mute uppercase">
              Label — last ping age
            </div>
            <div className="font-mono text-[13px] tabular-nums text-ink-soft">
              Mono — MH-04-KL-8821 · LR/2026/0088214
            </div>
          </div>
        </Section>

        {/* ----------------------------------------------------- buttons --- */}
        <Section title="Buttons" note="Hover, focus-visible, active, disabled and loading on every variant.">
          <Row label="Primary">
            <Button variant="primary">Assign</Button>
            <Button variant="primary" leading={<IconAlert size={14} />}>
              Raise exception
            </Button>
            <Button variant="primary" loading>
              Saving
            </Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </Row>
          <Row label="Secondary">
            <Button>Snooze</Button>
            <Button trailing={<IconArrowRight size={14} />}>Open trip</Button>
            <Button disabled>Disabled</Button>
          </Row>
          <Row label="Ghost / danger">
            <Button variant="ghost">Dismiss</Button>
            <Button variant="danger">Escalate</Button>
            <Button variant="ghost" size="sm">
              Small
            </Button>
          </Row>
          <Row label="Icon">
            <IconButton label="Filter">
              <IconFilter size={16} />
            </IconButton>
            <IconButton label="Filter active" active>
              <IconFilter size={16} />
            </IconButton>
            <IconButton label="Filter disabled" disabled>
              <IconFilter size={16} />
            </IconButton>
          </Row>
        </Section>

        {/* -------------------------------------------------------- state --- */}
        <Section title="State" note="Severity is encoded in shape as well as colour — critical is a diamond, high a square, the rest round.">
          <Row label="Chips">
            {TONES.map((t) => (
              <Chip key={t} tone={t}>
                {t}
              </Chip>
            ))}
            <Chip tone="crit" mono>
              EX-07
            </Chip>
          </Row>
          <Row label="Severity">
            {SEVERITIES.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-soft">
                <SeverityDot severity={s} />
                {s}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-soft">
              <SeverityDot severity="critical" pulse />
              new critical
            </span>
          </Row>
          <Row label="Status">
            <StatusPill tone="ok">Delivered</StatusPill>
            <StatusPill tone="info">In transit</StatusPill>
            <StatusPill tone="warn">At risk</StatusPill>
            <StatusPill tone="crit">SLA breached</StatusPill>
            <StatusPill tone="neutral">Not started</StatusPill>
          </Row>
          <Row label="Badges">
            {TONES.map((t) => (
              <Badge key={t} tone={t}>
                {t === "crit" ? 12 : 4}
              </Badge>
            ))}
          </Row>
        </Section>

        {/* ------------------------------------------------------- fields --- */}
        <Section title="Inputs">
          <Row label="Search">
            <SearchInput placeholder="Search LR or vehicle…" className="w-[260px]" hint={<KeyHint keys="mod+K" />} />
          </Row>
          <Row label="Select">
            <Select defaultValue="all" className="w-[180px]">
              <option value="all">All transporters</option>
              <option value="a">Sharda Roadlines</option>
              <option value="b">Deccan Carriers</option>
            </Select>
            <Select disabled defaultValue="all" className="w-[140px]">
              <option value="all">Disabled</option>
            </Select>
          </Row>
          <Row label="Segmented">
            <SegmentedControl
              label="Status filter"
              value={seg}
              onChange={setSeg}
              options={[
                { value: "all", label: "All" },
                { value: "risk", label: "At risk" },
                { value: "late", label: "Late" },
              ]}
            />
          </Row>
          <Row label="Toggle">
            <Toggle checked={on} onChange={setOn} label="Show lane arcs" />
            <span className="text-[12.5px] text-ink-mute">Show lane arcs</span>
          </Row>
          <Row label="Keys">
            <KeyHint keys="mod+K" />
            <KeyHint keys="shift+enter" />
            <KeyHint keys="esc" />
          </Row>
        </Section>

        {/* -------------------------------------------------------- table --- */}
        <Section title="Table" note="Row height and cell padding follow the density toggle in the sidebar.">
          <TableWrap className="rounded-sm border border-line">
            <Table label="Sample trips">
              <THead>
                <TH width={120}>LR no.</TH>
                <TH>Lane</TH>
                <TH width={150}>Transporter</TH>
                <TH width={130}>Vehicle</TH>
                <TH width={120}>Status</TH>
                <TH width={90} align="right" sortable sorted="desc">
                  Delay
                </TH>
              </THead>
              <TBody>
                {[
                  ["LR/26/088214", "Bhiwandi → Bengaluru", "Sharda Roadlines", "MH-04-KL-8821", "warn", "4h 20m"],
                  ["LR/26/088219", "Gurugram → Pune", "Deccan Carriers", "HR-55-AB-2210", "info", "—"],
                  ["LR/26/088231", "Dahej → Bhiwandi", "Narmada Logistics", "GJ-16-CT-7745", "crit", "11h 05m"],
                  ["LR/26/088244", "Hosur → Chennai", "Kaveri Transport", "TN-29-BV-3390", "ok", "—"],
                ].map(([lr, lane, tp, veh, tone, delay], i) => (
                  <TR key={lr} selected={i === 0}>
                    <TD mono>{lr}</TD>
                    <TD>{lane}</TD>
                    <TD>{tp}</TD>
                    <TD mono>{veh}</TD>
                    <TD>
                      <StatusPill tone={tone as Tone}>
                        {tone === "ok" ? "Delivered" : tone === "info" ? "In transit" : tone === "warn" ? "At risk" : "Breached"}
                      </StatusPill>
                    </TD>
                    <TD align="right" mono>
                      {delay}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        </Section>

        {/* ---------------------------------------------------- surfaces --- */}
        <Section title="Surfaces & feedback">
          <Row label="Metric">
            <div className="flex gap-6 rounded-sm border border-line-soft bg-raised px-4 py-3">
              <Metric label="In transit" value="1,204" unit="trips" />
              <Metric label="On-time" value="87.4" unit="%" />
              <Metric label="At risk" value="63" />
            </div>
          </Row>
          <Row label="Card">
            <Card className="w-[220px]">
              <div className="text-[12.5px] font-medium text-ink">Sharda Roadlines</div>
              <div className="mt-0.5 text-[11.5px] text-ink-mute">142 active trips</div>
            </Card>
            <Card interactive className="w-[220px]">
              <div className="text-[12.5px] font-medium text-ink">Deccan Carriers</div>
              <div className="mt-0.5 text-[11.5px] text-ink-mute">Interactive card</div>
            </Card>
          </Row>
          <Row label="Overlays">
            <Button onClick={() => setDrawer(true)}>Open drawer</Button>
            <Button onClick={() => setModal(true)}>Open modal</Button>
            <Tooltip label="Hover or focus me">
              <Button variant="ghost">Tooltip</Button>
            </Tooltip>
          </Row>
          <Row label="Toasts">
            <Button onClick={() => toast.push({ tone: "ok", title: "Transporter notified", detail: "Sharda Roadlines · LR/26/088214" })}>
              Success
            </Button>
            <Button onClick={() => toast.push({ tone: "warn", title: "ETA revised", detail: "New commit 18:40 IST, 4h 20m late" })}>
              Warning
            </Button>
            <Button onClick={() => toast.push({ tone: "crit", title: "E-way bill expires in 2h 10m", detail: "GJ-16-CT-7745 · 340 km still to run" })}>
              Critical
            </Button>
          </Row>
          <Row label="Loading">
            <Skeleton className="h-8 w-[160px]" />
            <Skeleton className="h-8 w-8" rounded="full" />
          </Row>
        </Section>

        <Section title="Empty state">
          <EmptyState
            icon={<IconTrack size={26} />}
            title="No exceptions in this view"
            description="Nothing on the selected lanes is breaching SLA right now. Widen the filter or clear it to see the whole network."
            action={<Button variant="secondary">Clear filters</Button>}
          />
        </Section>
      </div>

      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        title="LR/26/088214"
        subtitle="Bhiwandi → Bengaluru · Sharda Roadlines"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDrawer(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setDrawer(false)}>
              Notify transporter
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-ink-soft">
          Escape closes this, Tab cycles inside it, and focus returns to the button
          that opened it. Every overlay in the app uses the same trap.
        </p>
      </Drawer>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Snooze exception"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setModal(false)}>
              Snooze 2 hours
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-ink-soft">
          A snoozed exception keeps ageing in the background and returns to the top of
          the queue when the timer runs out.
        </p>
      </Modal>
    </div>
  );
}
