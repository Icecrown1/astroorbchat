import { create } from 'zustand';

export type SubscriptionTier = 'free' | 'standard' | 'premium';

interface OrbsState {
  orbs: number;
  maxOrbs: number;
  tier: SubscriptionTier;
  resetAt: Date | null;
  setOrbs: (orbs: number) => void;
  setMaxOrbs: (maxOrbs: number) => void;
  setTier: (tier: SubscriptionTier) => void;
  setResetAt: (date: Date | null) => void;
  decreaseOrbs: (amount: number) => void;
  
  // Legacy compatibility (energy maps to orbs)
  energy: number;
  setEnergy: (energy: number) => void;
  decreaseEnergy: (amount: number) => void;
}

export const useEnergy = create<OrbsState>((set) => ({
  orbs: 0,
  maxOrbs: 0,
  tier: 'free',
  resetAt: null,
  
  setOrbs: (orbs) => set({ orbs, energy: orbs }),
  setMaxOrbs: (maxOrbs) => set({ maxOrbs }),
  setTier: (tier) => set({ tier }),
  setResetAt: (date) => set({ resetAt: date }),
  decreaseOrbs: (amount) => set((state) => ({ 
    orbs: Math.max(0, state.orbs - amount),
    energy: Math.max(0, state.energy - amount)
  })),
  
  // Legacy compatibility
  energy: 0,
  setEnergy: (energy) => set({ energy, orbs: energy }),
  decreaseEnergy: (amount) => set((state) => ({ 
    energy: Math.max(0, state.energy - amount),
    orbs: Math.max(0, state.orbs - amount)
  })),
}));

// Re-export for convenience
export const useOrbs = useEnergy;
