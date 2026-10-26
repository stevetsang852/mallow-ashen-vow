import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType } from "react";

/**
 * Developer path for the hidden combat shell.
 * The module is fetched only after this route mounts — `/` does not import it.
 * Reach it via `/play`, or via `/?game=1` (and `VITE_MALLOW_GAME=1`) which redirects here.
 */
export const Route = createFileRoute("/play")({
  component: HiddenPlay,
});

function HiddenPlay() {
  const [Home, setHome] = useState<ComponentType | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let dead = false;
    void import("@/_hidden/gameHome")
      .then((mod) => {
        if (!dead) setHome(() => mod.GameHome);
      })
      .catch(() => {
        if (!dead) setFailed(true);
      });
    return () => {
      dead = true;
    };
  }, []);

  if (failed) {
    return (
      <main className="grid h-dvh place-items-center bg-bg text-fg">
        <p className="text-sm">玩法模組沒有載入。</p>
      </main>
    );
  }

  if (!Home) {
    return (
      <main className="grid h-dvh place-items-center bg-bg text-muted">
        <p className="text-sm tracking-widest">載入隱藏玩法…</p>
      </main>
    );
  }

  return <Home />;
}
