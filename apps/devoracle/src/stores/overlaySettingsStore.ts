import { create } from "zustand";

const STORAGE_KEY = "savant_overlay_settings";

export type OverlaySettingsState = {
  showDuringSessions: boolean;
  /** 0.5 – 1.0 */
  opacity: number;
  setShowDuringSessions: (v: boolean) => void;
  setOpacity: (v: number) => void;
};

function load(): Pick<OverlaySettingsState, "showDuringSessions" | "opacity"> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { showDuringSessions: true, opacity: 1 };
    const p = JSON.parse(raw) as { showDuringSessions?: boolean; opacity?: number };
    const opacity =
      typeof p.opacity === "number"
        ? Math.min(1, Math.max(0.5, p.opacity))
        : 1;
    return {
      showDuringSessions: p.showDuringSessions !== false,
      opacity,
    };
  } catch {
    return { showDuringSessions: true, opacity: 1 };
  }
}

function persist(state: Pick<OverlaySettingsState, "showDuringSessions" | "opacity">) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        showDuringSessions: state.showDuringSessions,
        opacity: state.opacity,
      }),
    );
    if (typeof BroadcastChannel !== "undefined") {
      new BroadcastChannel("savant-overlay").postMessage({
        opacity: state.opacity,
        showDuringSessions: state.showDuringSessions,
      });
    }
  } catch {
    /* ignore */
  }
}

export const useOverlaySettingsStore = create<OverlaySettingsState>((set, get) => ({
  ...load(),
  setShowDuringSessions: (showDuringSessions) => {
    set({ showDuringSessions });
    persist({ showDuringSessions, opacity: get().opacity });
  },
  setOpacity: (opacity) => {
    const o = Math.min(1, Math.max(0.5, opacity));
    set({ opacity: o });
    persist({ showDuringSessions: get().showDuringSessions, opacity: o });
  },
}));
