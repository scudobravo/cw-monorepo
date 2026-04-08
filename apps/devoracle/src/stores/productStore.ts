import { create } from "zustand";

export type Product = "DevOracle" | "RingWise";

interface ProductStore {
  active: Product;
  setActive: (product: Product) => void;
}

export const useProductStore = create<ProductStore>((set) => ({
  active: "DevOracle",
  setActive: (active) => set({ active }),
}));
