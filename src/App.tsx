import { useEffect } from "react";
import { AnnouncerProvider } from "./a11y/Announcer";
import { ShortcutSheet } from "./a11y/ShortcutSheet";
import { Shell } from "./app/Shell";
import { navigate, useLocation } from "./app/router";
import { resolve } from "./app/routes";
import { Button, EmptyState, Panel, ToastProvider } from "./ui";
import { ErrorBoundary } from "./ui/ErrorBoundary";

export default function App() {
  const path = useLocation();
  const match = resolve(path);

  // Land on the control tower; the app has no separate home.
  useEffect(() => {
    if (path === "/" || path === "") navigate("/track", { replace: true });
  }, [path]);

  useEffect(() => {
    document.title = match ? `${match.route.title} · Control Tower` : "Control Tower";
  }, [match]);

  return (
    <ToastProvider>
      <AnnouncerProvider>
        <ShortcutSheet />

        <Shell title={match?.route.title ?? "Not found"} subtitle={match?.route.subtitle}>
          {match ? (
            // An outer boundary so a screen that fails to mount still leaves
            // the shell, the clock and the navigation working.
            <ErrorBoundary label={match.route.title}>
              {match.route.render(match.params)}
            </ErrorBoundary>
          ) : (
            <div className="h-full p-4">
              <Panel className="h-full">
                <div className="grid h-full place-items-center">
                  <EmptyState
                    title="No such screen"
                    description={`Nothing is routed at ${path}.`}
                    action={
                      <Button variant="primary" onClick={() => navigate("/track")}>
                        Back to the control tower
                      </Button>
                    }
                  />
                </div>
              </Panel>
            </div>
          )}
        </Shell>
      </AnnouncerProvider>
    </ToastProvider>
  );
}
