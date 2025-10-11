import { create } from 'zustand';

interface EnergyState {
  energy: number;
  resetAt: Date | null;
  setEnergy: (energy: number) => void;
  setResetAt: (date: Date) => void;
  decreaseEnergy: (amount: number) => void;
}

export const useEnergy = create<EnergyState>((set) => ({
  energy: 0,
  resetAt: null,
  setEnergy: (energy) => set({ energy }),
  setResetAt: (date) => set({ resetAt: date }),
  decreaseEnergy: (amount) => set((state) => ({ energy: Math.max(0, state.energy - amount) })),
}));
