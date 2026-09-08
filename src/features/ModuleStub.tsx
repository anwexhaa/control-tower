import { Button, EmptyState, Panel } from "../ui";
import { IconArrowRight } from "../ui/icons";
import { navigate } from "../app/router";

/* The four modules this build does not implement. They are reachable rather
   than hidden, and they say plainly what they would contain — a dead nav item
   reads as a bug, an honest one reads as scope. */

const BLURB: Record<string, { title: string; body: string }> = {
  Procure: {
    title: "Procurement lives here",
    body: "RFQ automation, contract and spot auctions, rate benchmarking against the transporter network, and bid award workflows.",
  },
  Execute: {
    title: "Execution lives here",
    body: "Indent placement, vehicle allocation, gate management at plants and warehouses, and dispatch confirmation.",
  },
  Settle: {
    title: "Settlement lives here",
    body: "Freight invoice validation against contracted rates, detention and demurrage claims, dispute handling and reconciliation.",
  },
  Decarbonize: {
    title: "Emissions intelligence lives here",
    body: "Scope 3 freight emissions by lane, mode and transporter, computed from the same trip data the control tower runs on.",
  },
};

export function ModuleStub({ module }: { module: string }) {
  const copy = BLURB[module] ?? {
    title: `${module} lives here`,
    body: "Not implemented in this build.",
  };

  return (
    <div className="h-full p-4">
      <Panel className="h-full">
        <div className="grid h-full place-items-center">
          <div className="max-w-[52ch]">
            <EmptyState
              title={copy.title}
              description={`${copy.body} Out of scope for this build, which implements Track and Pulse end to end.`}
              action={
                <Button
                  variant="secondary"
                  onClick={() => navigate("/track")}
                  trailing={<IconArrowRight size={14} />}
                >
                  Go to the control tower
                </Button>
              }
            />
          </div>
        </div>
      </Panel>
    </div>
  );
}
