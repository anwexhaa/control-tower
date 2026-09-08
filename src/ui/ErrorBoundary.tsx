import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./Button";

/* One pane failing must not take the console with it.

   A control tower is a screen somebody watches during an incident. If a chart
   throws while a truck is on fire, the right outcome is a dead chart and a
   working map — not a white page. Each pane is wrapped separately so the blast
   radius is the pane. */

interface Props {
  /** Named in the fallback, so a controller can say what broke. */
  label: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Nothing to report to in a demo, but the console is where somebody will
    // actually look, and the component stack is the useful half.
    console.error(`[${this.props.label}] failed to render`, error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        role="alert"
        className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 p-6 text-center"
      >
        <p className="text-[13px] font-medium text-crit">{this.props.label} stopped</p>
        <p className="max-w-[46ch] text-[12px] leading-relaxed text-ink-mute">
          The rest of the board is still live. {error.message}
        </p>
        <Button
          size="sm"
          variant="secondary"
          className="mt-1"
          onClick={() => this.setState({ error: null })}
        >
          Try again
        </Button>
      </div>
    );
  }
}
