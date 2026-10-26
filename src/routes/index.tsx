import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { PrevisStage } from "@/previs/PrevisStage";

/**
 * Public entry: looping Three.js greybox previs of storyboard shots A–G.
 * Gameplay is not imported here. `/?game=1` or `VITE_MALLOW_GAME=1` redirects
 * to `/play`, which loads `src/_hidden/gameHome.tsx`.
 * Refine motion and camera in `src/previs/shot.ts`. Clip ids live in `clips.ts`.
 */
type HomeSearch = { game?: "1" };

function wantsHiddenGame(search: HomeSearch): boolean {
  return search.game === "1" || import.meta.env.VITE_MALLOW_GAME === "1";
}

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): HomeSearch => {
    const raw = search.game;
    if (raw === "1" || raw === 1 || raw === true) return { game: "1" };
    return {};
  },
  component: Home,
});

function Home() {
  const search = Route.useSearch();
  const gated = wantsHiddenGame(search);
  const navigate = useNavigate();

  useEffect(() => {
    if (!gated) return;
    void navigate({ to: "/play", replace: true });
  }, [gated, navigate]);

  if (gated) {
    return (
      <main className="grid h-dvh place-items-center bg-bg text-fg">
        <p className="text-sm tracking-widest">開啟隱藏玩法…</p>
      </main>
    );
  }

  return <PrevisStage />;
}
