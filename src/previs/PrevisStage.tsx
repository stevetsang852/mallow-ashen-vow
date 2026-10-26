import { useEffect, useRef, useState } from "react";
import { GAME_VERSION } from "@/game/version";
import { beatAt, SHOT } from "@/previs/shot";
import type { PrevisHandle } from "@/previs/createPrevis";

/**
 * Public stage. Shot timing is in `shot.ts` — keep this component a player.
 */
export function PrevisStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const beatRef = useRef<HTMLParagraphElement>(null);
  const timeRef = useRef<HTMLParagraphElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const api = useRef<PrevisHandle | null>(null);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let dead = false;
    let handle: PrevisHandle | null = null;

    void import("@/previs/createPrevis").then(({ createPrevis }) => {
      if (dead || !canvasRef.current) return;
      handle = createPrevis(canvasRef.current, {
        onFrame: (frame) => {
          if (beatRef.current) beatRef.current.textContent = frame.label;
          if (timeRef.current) {
            timeRef.current.textContent = `${frame.seconds.toFixed(1)} / ${SHOT.seconds.toFixed(1)}s`;
          }
          if (barRef.current) barRef.current.style.width = `${(frame.u * 100).toFixed(2)}%`;
        },
      });
      if (!handle) {
        if (!dead) setFailed(true);
        return;
      }
      if (dead) {
        handle.dispose();
        return;
      }
      handle.setPaused(pausedRef.current);
      api.current = handle;
    });

    return () => {
      dead = true;
      handle?.dispose();
      api.current = null;
    };
  }, []);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#c8c3bb] text-[#1c1917]">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        aria-label="粉誓灰盒預演，火芯走向剪影"
      />
      <div className="pointer-events-none absolute top-3 left-3 max-w-[16rem] bg-white/85 px-3 py-2 shadow-sm">
        <p className="font-display text-[10px] tracking-[0.22em] text-[#78716c]">
          PREVIS · GREYBOX
        </p>
        <p className="font-display text-xl leading-tight">粉誓 {GAME_VERSION}</p>
        <p ref={beatRef} className="mt-1 text-sm">
          {beatAt(0)}
        </p>
        <p ref={timeRef} className="text-xs text-[#57534e]">
          {`0.0 / ${SHOT.seconds.toFixed(1)}s`}
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-[#57534e]">
          結構灰盒，外觀以後再上。循環鏡頭，不是戰鬥。
        </p>
      </div>
      <button
        type="button"
        className="absolute top-3 right-3 min-h-10 border border-[#a8a29e] bg-white/90 px-3 text-sm"
        aria-pressed={paused}
        onClick={() => {
          const next = !paused;
          pausedRef.current = next;
          setPaused(next);
          api.current?.setPaused(next);
        }}
      >
        {paused ? "繼續" : "暫停"}
      </button>
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-black/15"
        aria-hidden="true"
      >
        <div ref={barRef} className="h-full bg-[#e85d04]" style={{ width: "0%" }} />
      </div>
      {failed && (
        <p className="absolute inset-x-0 top-1/2 px-6 text-center text-sm" role="alert">
          這台裝置開不了 WebGL，灰盒沒有升起。
        </p>
      )}
    </main>
  );
}
