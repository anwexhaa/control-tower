import { useEffect } from "react";
import { Shell } from "./app/Shell";
import { navigate, useLocation } from "./app/router";
import { resolve } from "./app/routes";
import { Button, EmptyState, Panel, ToastProvider } from "./ui";

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
      <Shell
        title={match?.route.title ?? "Not found"}
        subtitle={match?.route.subtitle}
      >
        {match ? (
          match.route.render(match.params)
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
    </ToastProvider>
  );
}
