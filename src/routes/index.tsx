import { createFileRoute } from "@tanstack/react-router";
import { Flame, Shield, Swords, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  createGame,
  INITIAL_HUD,
  type GameApi,
  type HudSnap,
} from "@/game/createGame";

const PAYME = "https://payme.hsbc/d6d295dff7854566b4536a98f0b02ef8";

const CREDIT_NOTE = `謝謝你陪騎士貓走到這裡。
如果牠的戰鬥讓你覺得過瘾，也想看牠繼續打下去，
歡迎用 PayMe 支持我。
你的一份心意，會變成下一場冒險的燃料。`;

function Credits() {
  return (
    <section className="pointer-events-auto border border-line bg-surface/95 p-4">
      <p className="font-display text-xs tracking-widest text-ember">開發者名單</p>
      <p className="mt-1 font-display text-xl text-fg">YIN T</p>
      <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-muted">{CREDIT_NOTE}</p>
      <a
        href={PAYME}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-block bg-fg p-2"
      >
        <img
          src="/payme-qr.png"
          alt="PayMe 贊助 QR Code，連到 YIN T"
          width={144}
          height={144}
          className="h-36 w-36"
        />
      </a>
      <p className="mt-2 text-sm text-steel">點 QR，或用 PayMe 掃描</p>
    </section>
  );
}

export const Route = createFileRoute("/")({ component: Home });

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const api = useRef<GameApi | null>(null);
  const [hud, setHud] = useState<HudSnap>(INITIAL_HUD);
  const [cardOn, setCardOn] = useState(false);
  const prevAsh = useRef(0);
  const [ashFly, setAshFly] = useState<{ id: number; n: number } | null>(null);
  const hpPct = Math.max(0, Math.min(100, (hud.hp / Math.max(1, hud.hpMax)) * 100));
  const staPct = Math.max(0, Math.min(100, (hud.sta / Math.max(1, hud.staMax)) * 100));
  const bossPct = Math.max(0, Math.min(100, ((hud.bossHp ?? 0) / Math.max(1, hud.bossMax)) * 100));
  const demonPct = Math.max(0, Math.min(100, ((hud.demonHp ?? 0) / Math.max(1, hud.demonMax)) * 100));

  useEffect(() => {
    if (hud.phase !== "dead" && hud.phase !== "win") {
      setCardOn(false);
      return;
    }
    setCardOn(false);
    const wait = hud.phase === "dead" ? 650 : 900;
    const id = window.setTimeout(() => setCardOn(true), wait);
    return () => window.clearTimeout(id);
  }, [hud.phase]);

  useEffect(() => {
    if (hud.ash > prevAsh.current) {
      setAshFly({ id: Date.now(), n: hud.ash - prevAsh.current });
    }
    prevAsh.current = hud.ash;
  }, [hud.ash]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = createGame(canvas, { onHud: setHud });
    api.current = game;
    return () => {
      game.dispose();
      api.current = null;
    };
  }, []);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg text-fg select-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        aria-label="粉誓庭院"
      />

      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          opacity: hud.hurt,
          background: "radial-gradient(circle, transparent 42%, rgba(226,59,59,0.55) 100%)",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          opacity: hud.guard,
          background: "radial-gradient(circle, transparent 55%, rgba(243,239,231,0.45) 100%)",
        }}
        aria-hidden="true"
      />

      {hud.phase !== "title" && (
        <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="w-full max-w-xs">
              <p className="font-display text-xs tracking-widest text-muted">粉誓庭院</p>
              <div className="mt-1 h-3 border border-line bg-surface">
                <div className="h-full bg-hp" style={{ width: `${hpPct}%` }} />
              </div>
              <div className={`mt-1 h-1.5 border bg-surface ${hud.sta < 16 ? "border-muted" : "border-line"}`}>
                <div
                  className="h-full bg-sta"
                  style={{ width: `${staPct}%`, opacity: hud.staFlash > 0 ? 0.45 : 1 }}
                />
              </div>
              <div className="mt-2 flex items-center gap-1">
                {Array.from({ length: hud.flaskMax }, (_, i) => (
                  <span
                    key={i}
                    className={i < hud.flasks ? "h-3 w-3 bg-ember" : "h-3 w-3 border border-line bg-surface opacity-35"}
                  />
                ))}
                <span className="relative ml-2 text-sm text-muted">
                  灰 {hud.ash}
                  {ashFly && (
                    <span key={ashFly.id} className="absolute -top-4 left-0 animate-pulse text-ember">
                      +{ashFly.n}
                    </span>
                  )}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="pointer-events-auto grid h-11 w-11 place-items-center border border-line bg-surface text-fg"
              onClick={() => api.current?.toggleMute()}
              aria-label={hud.muted ? "開啟聲音" : "關閉聲音"}
            >
              {hud.muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
            </button>
          </div>
          {hud.demonShown && (
            <div className="mx-auto w-full max-w-xs text-center">
              <p className="font-display text-xs tracking-widest text-hp">線上惡魔 · {hud.demonName}</p>
              <div className="mt-1 h-2 border border-line bg-surface">
                <div className="h-full bg-hp" style={{ width: `${demonPct}%` }} />
              </div>
            </div>
          )}
          {hud.bossShown && (
            <div className="mx-auto w-full max-w-xs text-center">
              <p className="font-display text-xs tracking-widest text-ember">
                煤灰公爵{hud.bossPhase > 1 ? " · 第二階段" : ""}
              </p>
              <div className="mt-1 h-2 border border-line bg-surface">
                <div className={hud.bossPhase > 1 ? "h-full bg-hp" : "h-full bg-ember"} style={{ width: `${bossPct}%` }} />
              </div>
            </div>
          )}
          {hud.lockName && (
            <div className="mx-auto w-full max-w-[10rem] text-center">
              <p className="font-display text-sm text-fg">鎖定 · {hud.lockName}{hud.punish ? " · 可打" : ""}</p>
              <div className="mt-1 h-1 border border-line bg-surface">
                <div
                  className="h-full bg-ember"
                  style={{ width: `${Math.max(0, Math.min(100, ((hud.poise ?? 0) / Math.max(1, hud.poiseMax)) * 100))}%` }}
                />
              </div>
            </div>
          )}
          {hud.banner && (
            <p className="text-center font-display text-2xl tracking-widest text-hp">{hud.banner}</p>
          )}
          {hud.toast && <p className="text-center text-sm text-fg">{hud.toast}</p>}
          {hud.nearFire && hud.phase === "play" && (
            <div className="pointer-events-auto mx-auto flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                className="min-h-11 border border-line bg-surface px-4 text-sm text-fg"
                onClick={() => api.current?.rest()}
              >
                <Flame className="mr-2 inline size-4 text-ember" />
                G 歇息
              </button>
              {hud.canTemper && (
                <button
                  type="button"
                  className="min-h-11 bg-ember px-4 text-sm text-bg"
                  onClick={() => api.current?.temper()}
                >
                  F 鍛誓 +12（200 灰）
                </button>
              )}
            </div>
          )}
        </header>
      )}

      {(hud.phase === "title" || hud.menuOpen) && (
        <section className="absolute top-4 right-4 left-4 z-40 max-h-[calc(100%-2rem)] overflow-y-auto border border-line bg-surface/95 p-5 sm:max-w-sm">
          <p className="font-display text-xs tracking-widest text-ember">ASHEN VOW</p>
          <h1 className="mt-1 font-display text-4xl text-fg">粉誓</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            戴粉紅蝴蝶結的騎士貓。先單挑路中灰殼，輕擊再滾。兩側灰殼很重，按住格擋。重擊和格擋會累架勢，崩了就能砍。舉劍是公爵的重擊要滾，圈往外擴是震地要退，低頭是衝鋒。衝鋒收招最長。第一刀會打開刀聲。
          </p>
          <p className="mt-3 text-sm leading-relaxed text-steel">
            WASD 走 · Shift 跑 · 左鍵或 J 輕擊 · 右鍵或 K 重擊 · 打完才能再砍 · 按住 C 格擋 · Space 翻滾 · Q 鎖定 · E 或 R 食水 · G 火芯 · Esc 選單
          </p>
          {hud.menuOpen && hud.phase === "play" && (
            <p className="mt-2 text-sm text-ember">選單開著，庭院沒有停下。</p>
          )}
          {!hud.webgl && (
            <p className="mt-3 text-sm text-hp">這台裝置開不了 WebGL，庭院沒有升起。</p>
          )}
          {hud.deaths > 0 && (
            <p className="mt-2 text-sm text-muted">
              倒下 {hud.deaths} 次
              {hud.bestMs != null ? ` · 最快 ${fmt(hud.bestMs)}` : ""}
              {hud.clears > 0 ? ` · 平靜 ${hud.clears}` : ""}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-11 bg-ember px-6 font-display tracking-widest text-bg"
              onClick={() => (hud.phase === "title" ? api.current?.begin() : api.current?.closeMenu())}
            >
              {hud.phase === "title" ? "Start" : "繼續"}
            </button>
            <button
              type="button"
              className="min-h-11 border border-line px-4 text-sm text-fg"
              onClick={() => api.current?.toggleMute()}
            >
              {hud.muted ? "開啟聲音" : "聲音已開"}
            </button>
          </div>
          <div className="mt-4">
            <Credits />
          </div>
        </section>
      )}

      {hud.phase === "dead" && (
        <section className="absolute inset-0 z-30 flex items-center justify-center bg-bg p-6">
          <div className={`max-w-sm text-center transition-opacity duration-300 ${cardOn ? "opacity-100" : "opacity-0"}`}>
            <p className="font-display text-xs tracking-widest text-ember">FALLEN</p>
            <h2 className="mt-2 font-display text-4xl text-fg">誓約斷了</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              灰留在你倒下的地方。火芯還在。這一次 {fmt(hud.runMs)}，累計倒下 {hud.deaths} 次。
            </p>
            <button
              type="button"
              className="mt-5 min-h-11 bg-ember px-6 font-display tracking-widest text-bg"
              onClick={() => api.current?.rise()}
            >
              從火芯再起
            </button>
          </div>
        </section>
      )}

      {hud.phase === "win" && (
        <section className={`absolute inset-0 z-30 flex items-center justify-center overflow-y-auto p-6 transition-colors ${cardOn ? "bg-bg/75" : "bg-transparent"}`}>
          <div className={`max-w-sm text-center transition-opacity duration-300 ${cardOn ? "opacity-100" : "opacity-0"}`}>
            <p className="font-display text-xs tracking-widest text-ember">STILL</p>
            <h2 className="mt-2 font-display text-4xl text-fg">庭院安靜了</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              粉紅的誓約還在。這一次 {fmt(hud.runMs)}
              {hud.bestMs != null ? `，最快 ${fmt(hud.bestMs)}` : ""}。
            </p>
            <button
              type="button"
              className="mt-5 min-h-11 bg-ember px-6 font-display tracking-widest text-bg"
              onClick={() => api.current?.again()}
            >
              再走一次庭院
            </button>
            <div className="mt-5 text-left">
              <Credits />
            </div>
          </div>
        </section>
      )}

      <div className="touch-controls pointer-events-none absolute inset-0 z-20">
        {hud.phase === "play" && (
          <>
            <Stick onChange={(x, y) => api.current?.setStick(x, y)} />
            <div className="pointer-events-auto absolute right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] flex flex-col items-end gap-2">
              <div className="flex gap-2">
                <TouchBtn label="鎖" big onPress={() => api.current?.lock()}>
                  <Shield className="size-6" />
                </TouchBtn>
                <TouchBtn label="瓶" onPress={() => api.current?.flask()}>
                  <Flame className="size-5" />
                </TouchBtn>
              </div>
              <div className="flex gap-2">
                <TouchBtn label="滾" big onPress={() => api.current?.dodge()}>
                  <span className="font-display text-base">滾</span>
                </TouchBtn>
                <TouchBtn label="斬" onPress={() => api.current?.attack()}>
                  <Swords className="size-5" />
                </TouchBtn>
                <TouchBtn label="重" onPress={() => api.current?.heavy()}>
                  <span className="font-display text-sm text-ember">重</span>
                </TouchBtn>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function TouchBtn({
  label,
  onPress,
  big,
  children,
}: {
  label: string;
  onPress: () => void;
  big?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`grid place-items-center border border-line bg-surface/95 text-fg touch-none ${big ? "h-20 w-20" : "h-16 w-16"}`}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onPress();
      }}
    >
      {children}
    </button>
  );
}

function Stick({ onChange }: { onChange: (x: number, y: number) => void }) {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  function update(clientX: number, clientY: number) {
    const rect = base.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let x = (clientX - cx) / (rect.width / 2);
    let y = -((clientY - cy) / (rect.height / 2));
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }
    setKnob({ x: x * 32, y: -y * 32 });
    onChange(x, y);
  }

  return (
    <div
      ref={base}
      className="pointer-events-auto absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] grid h-32 w-32 place-items-center rounded-full border border-line bg-surface/80 touch-none"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) update(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
        setKnob({ x: 0, y: 0 });
        onChange(0, 0);
      }}
    >
      <span
        className="h-12 w-12 rounded-full bg-steel"
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
      />
    </div>
  );
}
