import { create } from "zustand";
import type { StealthConfig } from "../lib/tauri";
import * as tauri from "../lib/tauri";

interface StealthStore {
  isActive: boolean;
  config: StealthConfig | null;
  isLoading: boolean;

  loadConfig: () => Promise<void>;
  updateConfig: (config: StealthConfig) => Promise<void>;
  toggle: () => Promise<void>;
  setActive: (active: boolean) => void;
}

export const useStealthStore = create<StealthStore>((set) => ({
  isActive: false,
  config: null,
  isLoading: false,

  loadConfig: async () => {
    set({ isLoading: true });
    const [config, isActive] = await Promise.all([
      tauri.getStealthConfig(),
      tauri.getStealthState(),
    ]);
    set({ config, isActive, isLoading: false });
  },

  updateConfig: async (config) => {
    await tauri.updateStealthConfig(config);
    set({ config });
  },

  toggle: async () => {
    const isActive = await tauri.toggleStealth();
    set({ isActive });
  },

  setActive: (active) => set({ isActive: active }),
}));
