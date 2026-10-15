/**
 * Player input handling — extracted from createGame.ts.
 * Keeps createGame focused on simulation; input logic stays in one place.
 */
import type { GameApi, Phase } from "./hud.ts";

export type HeldKeys = Set<string>;

export function held(keys: HeldKeys, code: string): boolean {
  return keys.has(code);
}

export function buildInputHandlers(api: GameApi, signal: AbortSignal): {
  setKeys: (keys: string[]) => void;
  clearKeys: () => void;
} {
  const held = new HeldKeys();

  function setKeys(keys: string[]) {
    held.clear();
    for (const k of keys) held.add(k);
  }

  function clearKeys() {
    held.clear();
  }

  // Keyboard
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.repeat) return;
      held.add(e.code);
      // Game actions
      if (e.code === "KeyJ" || e.code === "Mouse0") api.attack("light");
      if (e.code === "KeyK" || e.code === "Mouse1") api.attack("heavy");
      if (e.code === "KeyC") api.block(true);
      if (e.code === "Space") api.dodge();
      if (e.code === "KeyQ") api.lockNext();
      if (e.code === "KeyE") api.interact();
      if (e.code === "KeyG") api.rest();
      if (e.code === "KeyF") api.temper();
      // Hotbar 1-4
      if (e.code.startsWith("Digit") || e.code.startsWith("Numpad")) {
        const n = parseInt(e.code.replace("Digit", "").replace("Numpad", ""), 10);
        if (!isNaN(n) && n >= 1 && n <= 4) api.hotbarSelect(n - 1);
      }
      // Debug toggle
      if (e.code === "KeyV" && !e.ctrlKey && !e.metaKey) {
        // vowdebug handled in createGame
      }
    },
    { signal },
  );

  window.addEventListener(
    "keyup",
    (e) => {
      held.delete(e.code);
      if (e.code === "KeyC") api.block(false);
    },
    { signal },
  );

  return { setKeys, clearKeys };
}
