import { create } from 'zustand';
import type { ReactNode } from 'react';

export interface HeaderAction {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'ghost';
  className?: string;
}

interface HeaderActionsState {
  actions: HeaderAction[];
  title: string | null;
  setActions: (actions: HeaderAction[]) => void;
  setTitle: (title: string | null) => void;
  clear: () => void;
}

export const useHeaderActionsStore = create<HeaderActionsState>((set) => ({
  actions: [],
  title: null,
  setActions: (actions) => set({ actions }),
  setTitle: (title) => set({ title }),
  clear: () => set({ actions: [], title: null }),
}));
