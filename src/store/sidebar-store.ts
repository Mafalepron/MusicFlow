import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarState {
  // Whether the left sidebar is collapsed (retracted).
  // Persisted to localStorage so the user's preference survives reloads.
  isCollapsed: boolean;
  // Mobile-only: whether the sidebar drawer is open (slides in).
  // On desktop, the sidebar visibility is controlled by `isCollapsed`.
  isMobileOpen: boolean;
  toggle: () => void;
  setCollapsed: (collapsed: boolean) => void;
  setMobileOpen: (open: boolean) => void;
  toggleMobile: () => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      isCollapsed: false,
      isMobileOpen: false,
      toggle: () => set((s) => ({ isCollapsed: !s.isCollapsed })),
      setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
      setMobileOpen: (open) => set({ isMobileOpen: open }),
      toggleMobile: () => set((s) => ({ isMobileOpen: !s.isMobileOpen })),
    }),
    { name: 'soundflow-sidebar' }
  )
);
