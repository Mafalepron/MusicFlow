import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarState {
  // Whether the left sidebar is collapsed (retracted).
  // Persisted to localStorage so the user's preference survives reloads.
  isCollapsed: boolean;
  // Mobile-only: whether the sidebar drawer is open (slides in).
  // On desktop, the sidebar visibility is controlled by `isCollapsed`.
  isMobileOpen: boolean;
  // Whether the artist profile card inside the sidebar is collapsed.
  // When true, the project chat fills the freed space.
  // When false, the card and chat split the sidebar 50/50.
  profileCollapsed: boolean;
  toggle: () => void;
  setCollapsed: (collapsed: boolean) => void;
  setMobileOpen: (open: boolean) => void;
  toggleMobile: () => void;
  toggleProfile: () => void;
  setProfileCollapsed: (collapsed: boolean) => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      isCollapsed: false,
      isMobileOpen: false,
      profileCollapsed: false,
      toggle: () => set((s) => ({ isCollapsed: !s.isCollapsed })),
      setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
      setMobileOpen: (open) => set({ isMobileOpen: open }),
      toggleMobile: () => set((s) => ({ isMobileOpen: !s.isMobileOpen })),
      toggleProfile: () => set((s) => ({ profileCollapsed: !s.profileCollapsed })),
      setProfileCollapsed: (collapsed) => set({ profileCollapsed: collapsed }),
    }),
    { name: 'soundflow-sidebar' }
  )
);
