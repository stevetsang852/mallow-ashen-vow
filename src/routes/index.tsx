import { createFileRoute } from "@tanstack/react-router";
import { Flame, Shield, Swords, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  createGame,
  INITIAL_HUD,
  type GameApi,
  type HudSnap,
} from "@/game/createGame";
import { GAME_VERSION } from "@/game/version";

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
        <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-3 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="hud-plate w-full max-w-[14rem] rounded-sm bg-cinematic/80 px-2 py-1.5 backdrop-blur-[2px]">
              <p className="font-display text-[10px] tracking-[0.2em] text-muted/80">粉誓庭院</p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-sm border border-line/60 bg-surface/60">
                <div className="h-full bg-hp shadow-[0_0_6px_rgba(155,35,53,0.6)]" style={{ width: `${hpPct}%` }} />
              </div>
              <div className={`mt-1 h-1 overflow-hidden rounded-sm border bg-surface/60 ${hud.sta < 16 ? "border-muted/50" : "border-line/50"}`}>
                <div
                  className="h-full bg-sta shadow-[0_0_4px_rgba(214,195,122,0.4)]"
                  style={{ width: `${staPct}%`, opacity: hud.staFlash > 0 ? 0.4 : 1 }}
                />
              </div>
              <div className="mt-1.5 flex items-center gap-1">
                {Array.from({ length: hud.flaskMax }, (_, i) => (
                  <span
                    key={i}
                    className={i < hud.flasks ? "h-2 w-2 rounded-sm bg-ember shadow-[0_0_4px_rgba(232,93,4,0.5)]" : "h-2 w-2 rounded-sm border border-line/40 bg-surface/40 opacity-40"}
                  />
                ))}
                <span className="ml-1.5 text-[11px] tracking-wider text-muted/70">灰</span>
                {(hud.hasAshToken || hud.hasFlaskShard || hud.hasTorch || hud.hasExplosive || hud.hasHealHerb) && (
                  <span className="ml-2 text-[10px] tracking-wider text-ember/80">
                    {[
                      hud.hasAshToken ? "徽" : "",
                      hud.hasFlaskShard ? "片" : "",
                      hud.hasTorch ? "炬" : "",
                      hud.hasExplosive ? "炸" : "",
                      hud.hasHealHerb ? "藥" : "",
                    ]
                      .filter(Boolean)
                      .join("·")}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              className="pointer-events-auto grid h-9 w-9 place-items-center rounded-sm border border-line/50 bg-cinematic/70 text-fg/80 backdrop-blur-sm"
              onClick={() => api.current?.toggleMute()}
              aria-label={hud.muted ? "開啟聲音" : "關閉聲音"}
            >
              {hud.muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
          </div>
          {hud.demonShown && (
            <div className="hud-plate mx-auto w-full max-w-[14rem] rounded-sm bg-cinematic/70 px-2 py-1 text-center backdrop-blur-[1px]">
              <p className="font-display text-[10px] tracking-[0.18em] text-hp/90">線上惡魔 · {hud.demonName}</p>
              <div className="mt-0.5 h-1 overflow-hidden rounded-sm border border-line/40 bg-surface/50">
                <div className="h-full bg-hp" style={{ width: `${demonPct}%` }} />
              </div>
            </div>
          )}
          {hud.bossShown && (
            <div className="hud-plate mx-auto w-full max-w-[14rem] rounded-sm bg-cinematic/70 px-2 py-1 text-center backdrop-blur-[1px]">
              <p className="font-display text-[10px] tracking-[0.18em] text-ember/90">
                煤灰公爵{hud.bossPhase > 1 ? " · 第二階段" : ""}
              </p>
              <div
                className={
                  hud.bossPhase > 1 ? "boss-bar-track boss-bar-track--phase2" : "boss-bar-track"
                }
              >
                <div
                  className={
                    hud.bossPhase > 1 ? "boss-bar-fill boss-bar-fill--phase2" : "boss-bar-fill boss-bar-fill--phase1"
                  }
                  style={{ width: `${bossPct}%` }}
                />
              </div>
            </div>
          )}
          {hud.lockName && (
            <div
              className={`hud-plate hud-lock-plate mx-auto w-full max-w-[9rem] rounded-sm bg-cinematic/60 px-2 py-0.5 text-center backdrop-blur-[1px]${hud.punish ? " hud-lock-plate--punish" : ""}`}
            >
              <p className="hud-lock-name font-display text-[11px]">
                鎖定 · {hud.lockName}
                {hud.punish ? <span className="hud-lock-punish"> · 可打</span> : null}
              </p>
              <div className="mt-0.5 h-0.5 overflow-hidden rounded-sm border border-line/30 bg-surface/40">
                <div
                  className="h-full bg-ember"
                  style={{ width: `${Math.max(0, Math.min(100, ((hud.poise ?? 0) / Math.max(1, hud.poiseMax)) * 100))}%` }}
                />
              </div>
            </div>
          )}
          {hud.banner && (
            <p key={hud.banner} className="boss-banner" role="status">
              {hud.banner}
            </p>
          )}
          {hud.toast && <p className="text-center text-xs text-fg/80 drop-shadow">{hud.toast}</p>}
          {hud.phase === "play" && hud.lightCombo > 0 && (
            <div
              key={hud.lightCombo}
              className="hud-plate hud-combo-plate mx-auto w-fit min-w-[3.25rem] rounded-sm bg-cinematic/70 px-2.5 py-1 text-center backdrop-blur-[1px]"
              role="status"
              aria-label={`連擊 ${hud.lightCombo}`}
            >
              <p className="hud-combo-label font-display text-[9px] tracking-[0.22em] text-muted/75">連擊</p>
              <p className="hud-combo-count font-display text-lg leading-none tracking-wider">×{hud.lightCombo}</p>
            </div>
          )}
          {hud.nearItem && hud.phase === "play" && (
            <div className="pointer-events-auto mx-auto flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                className="min-h-10 rounded-sm border border-ember/50 bg-cinematic/80 px-3 text-xs text-fg backdrop-blur-sm"
                onClick={() => api.current?.interact()}
              >
                E 拾取 · {hud.nearItem}
              </button>
            </div>
          )}
          {hud.hasExplosive && !hud.nearItem && hud.phase === "play" && (
            <div className="pointer-events-auto mx-auto flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                className="min-h-10 rounded-sm border border-hp/50 bg-cinematic/80 px-3 text-xs text-fg backdrop-blur-sm"
                onClick={() => api.current?.interact()}
              >
                E 引爆 · 炸藥
              </button>
            </div>
          )}
          {hud.hasHealHerb && !hud.nearItem && !hud.hasExplosive && hud.phase === "play" && (
            <div className="pointer-events-auto mx-auto flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                className="min-h-10 rounded-sm border border-ember/40 bg-cinematic/80 px-3 text-xs text-fg backdrop-blur-sm"
                onClick={() => api.current?.interact()}
              >
                E 使用 · 恢復藥草
              </button>
            </div>
          )}
          {hud.nearFire && hud.phase === "play" && (
            <div className="pointer-events-auto mx-auto flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                className="min-h-10 rounded-sm border border-line/50 bg-cinematic/80 px-3 text-xs text-fg backdrop-blur-sm"
                onClick={() => api.current?.rest()}
              >
                <Flame className="mr-1.5 inline size-3.5 text-ember" />
                G 歇息
              </button>
              {hud.canTemper && (
                <button
                  type="button"
                  className="min-h-10 rounded-sm bg-ember/90 px-3 text-xs text-bg"
                  onClick={() => api.current?.temper()}
                >
                  F 鍛誓
                </button>
              )}
            </div>
          )}
        </header>
      )}

      {(hud.phase === "title" || hud.menuOpen) && (
        <section className="title-panel absolute top-4 right-4 left-4 z-40 max-h-[calc(100%-2rem)] overflow-y-auto border border-line bg-surface/95 p-5 sm:max-w-sm">
          <div className="title-panel-vignette" aria-hidden="true" />
          <p className="font-display text-xs tracking-widest text-ember">ASHEN VOW · {GAME_VERSION}</p>
          <h1 className="title-bow-accent mt-1 font-display text-4xl text-fg">
            粉誓
            <span className="title-bow-mark" aria-hidden="true" />
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            戴粉紅蝴蝶結的騎士貓。先單挑路中灰殼，輕擊再滾。兩側灰殼很重，按住格擋。重擊和格擋會累架勢，崩了就能砍。舉劍是公爵的重擊要滾，圈往外擴是震地要退，低頭是衝鋒。衝鋒收招最長。第一刀會打開刀聲。
          </p>
          <p className="mt-3 text-sm leading-relaxed text-steel">
            WASD 走 · Shift 跑 · 左鍵或 J 輕擊 · 右鍵或 K 重擊 · 打完才能再砍 · 按住 C 格擋 · Space 翻滾 · Q 鎖定 · E 食水 · G 火芯 · Esc 選單
          </p>
          {hud.menuOpen && hud.phase === "play" && (
            <p className="mt-2 text-sm text-ember">選單開著，庭院沒有停下。</p>
          )}
          {!hud.webgl && (
            <p className="mt-3 text-sm text-hp">這台裝置開不了 WebGL，庭院沒有升起。</p>
          )}
          {hud.phase === "title" && !hud.ready && (
            <div className="mt-4" aria-live="polite">
              <div className="flex items-center justify-between text-xs text-steel">
                <span>正在升起庭院</span>
                <span>{Math.round(hud.loadPct)}%</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden border border-line bg-bg">
                <div
                  className="h-full bg-ember transition-[width] duration-200"
                  style={{ width: `${Math.max(8, hud.loadPct)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted">模型未齊。按 Start 會等載完再開。</p>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-start-bow min-h-11 bg-ember px-6 font-display tracking-widest text-bg disabled:opacity-60"
              disabled={!hud.webgl}
              onClick={() => (hud.phase === "title" ? api.current?.begin() : api.current?.closeMenu())}
            >
              {hud.phase === "title" ? (hud.ready ? "Start" : "Loading") : "繼續"}
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
          <div
            className={`end-card end-card--dead transition-opacity duration-300 ${cardOn ? "end-card--on opacity-100" : "opacity-0"}`}
          >
            <p className="end-card-kicker font-display text-xs tracking-widest">FALLEN</p>
            <h2 className="end-card-title mt-2 font-display text-4xl">誓約斷了</h2>
            <p className="end-card-body mt-3 text-sm leading-relaxed">
              灰留在你倒下的地方。火芯還在。
            </p>
            <button
              type="button"
              className="mt-5 min-h-11 bg-steel/80 px-6 font-display tracking-widest text-bg"
              onClick={() => api.current?.rise()}
            >
              從火芯再起
            </button>
          </div>
        </section>
      )}

      {hud.phase === "win" && (
        <section className={`absolute inset-0 z-30 flex items-center justify-center overflow-y-auto p-6 transition-colors ${cardOn ? "bg-bg/75" : "bg-transparent"}`}>
          <div
            className={`end-card end-card--win transition-opacity duration-300 ${cardOn ? "end-card--on opacity-100" : "opacity-0"}`}
          >
            <p className="end-card-kicker font-display text-xs tracking-widest">STILL</p>
            <h2 className="end-card-title mt-2 font-display text-4xl">庭院安靜了</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              粉紅的誓約還在。
            </p>
            <div className="end-card-stats" aria-label="通關紀錄">
              <span>
                CLEARS
                <strong>{hud.clears}</strong>
              </span>
              <span>
                BEST
                <strong>{hud.bestMs != null ? fmt(hud.bestMs) : "—"}</strong>
              </span>
            </div>
            <button
              type="button"
              className="mt-5 min-h-11 bg-sta/90 px-6 font-display tracking-widest text-bg"
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
      className={`touch-btn touch-none ${big ? "touch-btn--lg" : "touch-btn--md"}`}
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
