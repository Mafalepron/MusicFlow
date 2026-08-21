'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, Bell, Menu, ChevronRight, ChevronDown, ChevronLeft,
  LogOut, Settings, Check, Copy,
  Home, Lightbulb, FolderOpen, LayoutGrid, Music,
  FolderKanban, Music2, Users, Zap, LayoutDashboard, Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNavigationStore, useAuthStore, useDataStore, type ViewName } from '@/lib/store';
import { useHeaderActionsStore } from '@/store/header-actions-store';
import { useSidebarStore } from '@/store/sidebar-store';
import { useKanbanStore, type Task } from '@/store/kanban-store';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { hexToRgba } from '@/lib/utils';
import { WaveformProgressBar } from '@/components/waveform-progress-bar';

const viewLabels: Record<string, string> = {
  home: 'Home',
  ideas: 'Ideas',
  projects: 'Projects',
  'project-detail': 'Project',
  'track-detail': 'Track',
  kanban: 'Kanban',
  'group-settings': 'Settings',
};

/* ─── neon synthwave palette (matches left sidebar + quick-access panel) ─── */
const NEON_CYAN = '#00f0ff';
const NEON_MAGENTA = '#ff00aa';
const NEON_CYAN_RGB = '0,240,255';
const NEON_MAGENTA_RGB = '255,0,170';
const FONT_DISPLAY = 'var(--font-rajdhani), sans-serif';
const FONT_MONO = 'var(--font-jetbrains-mono), monospace';

/* ─── Yellow accent button style (matches "Новый проект" in Projects view) ─── */
const YELLOW = '#FCEE0A';
const YELLOW_RGB = '252,238,10';
const YELLOW_BTN_CLIP = 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))';

export function AppHeader() {
  const { currentView, selectedProjectId, navigate } = useNavigationStore();
  const { user, logout, currentGroupName: persistedGroupName, currentGroupInviteCode: persistedInviteCode } = useAuthStore();
  const currentGroup = useDataStore((s) => s.currentGroup);
  const projects = useDataStore((s) => s.projects);
  const tracks = useDataStore((s) => s.tracks);
  const notifications = useDataStore((s) => s.notifications);
  const notificationCount = useDataStore((s) => s.notificationCount);
  const setNotifications = useDataStore((s) => s.setNotifications);
  const setNotificationCount = useDataStore((s) => s.setNotificationCount);
  const headerActions = useHeaderActionsStore((s) => s.actions);
  const headerTitle = useHeaderActionsStore((s) => s.title);
  const toggleSidebar = useSidebarStore((s) => s.toggleMobile);
  const isMobileSidebarOpen = useSidebarStore((s) => s.isMobileOpen);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ type: 'project' | 'track'; id: string; title: string; subtitle?: string }[]>([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  // Quick-access slide-down panel — triggered by clicking the purple center stripe.
  const [quickPanelOpen, setQuickPanelOpen] = useState(false);
  // Ideas + member count are fetched on demand for the quick panel.
  const ideas = useDataStore((s) => s.ideas);
  const currentGroupId = useAuthStore((s) => s.currentGroupId);
  const [memberCount, setMemberCount] = useState(0);
  // Quick-access project IDs — same source as the home page's "Быстрый доступ"
  // section. Read from localStorage so the header panel always shows the same
  // projects the user pinned on the home page.
  // We read localStorage directly during render, keyed on `quickPanelOpen`
  // so the value is re-read every time the panel opens. This is cheap
  // (synchronous localStorage read) and avoids the react-hooks/set-state-in-effect
  // lint rule that fires when you call setState inside a useEffect.
  const quickAccessIds: string[] = useMemo(() => {
    // Depend on quickPanelOpen so the memo recomputes every time the panel
    // opens — picks up any changes the user made on the home page.
    void quickPanelOpen;
    try {
      const raw = localStorage.getItem('soundflow-quick-access');
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch { return []; }
  }, [quickPanelOpen]);

  // Fetch member count whenever the group changes (used by the quick panel).
  useEffect(() => {
    if (!currentGroupId) return;
    fetch(`/api/groups/${currentGroupId}/members`)
      .then((r) => r.json())
      .then((m) => setMemberCount(Array.isArray(m) ? m.length : 0))
      .catch(() => {});
  }, [currentGroupId]);

  // Fetch kanban projects (top-level tasks) — same fetch the home page uses.
  // Needed because quick-access IDs can point to either auto projects or
  // kanban-only projects.
  const [kanbanProjects, setKanbanProjects] = useState<Task[]>([]);
  useEffect(() => {
    fetch('/api/tasks?parentId=null')
      .then((r) => r.json())
      .then((data) => {
        const tasks: Task[] = Array.isArray(data) ? data : data.tasks || [];
        setKanbanProjects(tasks);
        useKanbanStore.getState().setProjects(tasks);
      })
      .catch(() => {});
  }, []);

  // Build the unified quick-access list — same logic as the home page.
  // Maps the localStorage `quickAccess` IDs to auto projects + kanban projects.
  const autoProjects = useMemo(() => projects.filter((p) => p.kanbanTaskId), [projects]);
  const quickAccessCards = useMemo(() => {
    type Card =
      | { kind: 'auto'; id: string; title: string; type: string; status: string; trackCount: number }
      | { kind: 'kanban'; id: string; title: string; type: string; status: string; boardCount: number };
    const out: Card[] = [];
    quickAccessIds.forEach((id) => {
      const autoP = autoProjects.find((p) => p.id === id);
      if (autoP) {
        out.push({
          kind: 'auto',
          id: autoP.id,
          title: autoP.title,
          type: autoP.type,
          status: autoP.status,
          trackCount: tracks.filter((t) => t.projectId === autoP.id).length,
        });
        return;
      }
      const kanbanT = kanbanProjects.find((t) => t.id === id);
      if (kanbanT) {
        out.push({
          kind: 'kanban',
          id: kanbanT.id,
          title: kanbanT.title,
          type: kanbanT.projectType || 'general',
          status: kanbanT.status,
          boardCount: kanbanT.children?.length ?? 0,
        });
      }
    });
    return out;
  }, [quickAccessIds, autoProjects, kanbanProjects, tracks]);

  // Close the quick-access panel when the user clicks outside it or presses Escape.
  const quickPanelRef = useRef<HTMLDivElement>(null);
  const quickStripeRef = useRef<HTMLButtonElement>(null);
  const quickCardsScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!quickPanelOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (
        quickPanelRef.current && !quickPanelRef.current.contains(target) &&
        quickStripeRef.current && !quickStripeRef.current.contains(target)
      ) {
        setQuickPanelOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setQuickPanelOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [quickPanelOpen]);

  const groupName = currentGroup?.name || persistedGroupName || 'SoundFlow';
  const inviteCode = currentGroup?.inviteCode || persistedInviteCode || '';

  // Fetch notifications on mount
  useEffect(() => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;
    fetch(`/api/notifications?userId=${currentUser.id}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setNotifications(data);
          setNotificationCount(data.filter((n: { isRead: boolean }) => !n.isRead).length);
        }
      })
      .catch(() => {});
  }, [setNotifications, setNotificationCount]);

  // Close notification dropdown on outside click
  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen]);

  // Build breadcrumbs — group name removed from header (shown in sidebar)
  const breadcrumbs: { label: string; view?: string; projectId?: string }[] = [];

  if (currentView === 'project-detail' && selectedProjectId) {
    breadcrumbs.push({ label: 'Projects', view: 'projects' });
    const project = projects.find((p) => p.id === selectedProjectId);
    breadcrumbs.push({ label: project?.title || 'Project' });
  } else if (currentView === 'track-detail' && selectedProjectId) {
    breadcrumbs.push({ label: 'Projects', view: 'projects' });
    const project = projects.find((p) => p.id === selectedProjectId);
    breadcrumbs.push({ label: project?.title || 'Project', view: 'project-detail', projectId: selectedProjectId });
    breadcrumbs.push({ label: headerTitle || 'Track' });
  } else if (currentView !== 'home') {
    breadcrumbs.push({ label: headerTitle || viewLabels[currentView] || currentView });
  }

  // Search logic
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const pResults = projects
      .filter(p => p.title.toLowerCase().includes(q))
      .slice(0, 5)
      .map(p => ({ type: 'project' as const, id: p.id, title: p.title, subtitle: p.type }));
    const tResults = tracks
      .filter(t => t.title.toLowerCase().includes(q))
      .slice(0, 5)
      .map(t => ({ type: 'track' as const, id: t.id, title: t.title, subtitle: projects.find(p => p.id === t.projectId)?.title }));
    setSearchResults([...pResults, ...tResults]);
  }, [searchQuery, projects, tracks]);

  const handleSearchSelect = (result: { type: 'project' | 'track'; id: string; subtitle?: string }) => {
    if (result.type === 'project') {
      navigate('project-detail', result.id);
    } else {
      const track = tracks.find(t => t.id === result.id);
      if (track) navigate('track-detail', track.projectId, track.id);
    }
    setSearchOpen(false);
    setSearchQuery('');
  };

  const markAsRead = async (id: string) => {
    fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    });
    setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n));
    setNotificationCount(Math.max(0, notificationCount - 1));
  };

  const markAllRead = async () => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;
    fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true, userId: currentUser.id }),
    });
    setNotifications(notifications.map(n => ({ ...n, isRead: true })));
    setNotificationCount(0);
  };

  const handleNotificationClick = (notif: typeof notifications[number]) => {
    markAsRead(notif.id);
    setNotifOpen(false);
    if (notif.type === 'chat_message' || notif.type === 'track_version' || notif.type === 'comment') {
      navigate('project-detail', notif.projectId);
    }
  };

  const handleCopyCode = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('onboarding');
  };

  const handleHomeClick = () => {
    navigate('home');
  };

  return (
    <>
      {/* Wrapper — sticky so it stays pinned at the top of the viewport
          alongside the header inside it. position: relative so the panel
          (position: absolute, top: 56px) anchors to THIS wrapper's center
          instead of the viewport center — keeps the panel aligned with the
          header's horizontal center even when a sidebar offsets the header
          from the viewport center. */}
      <div className="sticky top-0 z-30 relative" style={{ width: '100%' }}>
      {/* Unified Header — neon synthwave glassmorphism bar (matches the left
          sidebar + quick-access panel: dark glass + cyan border + neon glow) */}
      <header
        className="flex h-14 items-center gap-2 px-3 lg:px-6"
        style={{
          background: 'rgba(10,14,23,0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: `1px solid rgba(${NEON_CYAN_RGB},0.3)`,
          boxShadow: `0 0 24px rgba(${NEON_CYAN_RGB},0.15), 0 0 8px rgba(${NEON_MAGENTA_RGB},0.1), 0 4px 16px rgba(0,0,0,0.6)`,
        }}
      >
        {/* Embedded neon-yellow stripe centered in header — CLICKABLE button
            that opens a quick-access slide-down panel (projects, tracks,
            ideas, participants). The stripe + chevron are stacked vertically
            and centered horizontally. The stripe pulses + scales on hover so
            it reads as interactive. Styled to match the yellow "Новый проект"
            button: bright #FCEE0A with a glow. */}
        <button
          ref={quickStripeRef}
          onClick={() => setQuickPanelOpen((o) => !o)}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 group flex flex-col items-center justify-center gap-0.5"
          style={{ width: '180px', height: '40px', background: 'transparent', border: 'none', cursor: 'pointer' }}
          title="Избранное — проекты, треки, идеи, участники"
          aria-label="Открыть панель быстрого доступа"
        >
          {/* Yellow stripe — bright neon-yellow with glow */}
          <div
            className="pointer-events-none transition-all duration-200 group-hover:scale-x-110 group-hover:opacity-100"
            style={{
              width: '120px',
              height: '3px',
              background: YELLOW,
              boxShadow: quickPanelOpen
                ? `0 0 14px ${YELLOW}, 0 0 6px ${YELLOW}, 0 0 2px #fff8a0`
                : `0 0 10px ${YELLOW}, 0 0 4px ${YELLOW}`,
              opacity: quickPanelOpen ? 1 : 0.9,
              borderRadius: '1.5px',
            }}
          />
          {/* Tiny chevron indicator — directly below the stripe, centered.
              Flips direction when the panel is open. */}
          <ChevronDown
            className="transition-transform duration-200 group-hover:opacity-100"
            style={{
              color: YELLOW,
              width: '12px',
              height: '12px',
              opacity: 0.8,
              transform: quickPanelOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              filter: `drop-shadow(0 0 3px rgba(${YELLOW_RGB},0.6))`,
              marginTop: '-1px',
            }}
          />
        </button>

        {/* Quick-access slide-down panel — rendered OUTSIDE the header (after
            </header>) via a fixed-position overlay so the header's clipPath
            doesn't clip it. See the AnimatePresence block below the header. */}

        {/* Mobile: hamburger menu — toggles the new retractable sidebar.
            Styled as a yellow accent button (matches "Новый проект"). */}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                aria-label="Меню"
                aria-pressed={isMobileSidebarOpen}
                className={cn(
                  'lg:hidden h-9 w-9 shrink-0 transition-all duration-200'
                )}
                style={{
                  clipPath: YELLOW_BTN_CLIP,
                  background: 'linear-gradient(135deg, #FCEE0A, #F1F100 50%, #FCEE0A)',
                  border: '1.5px solid rgba(252,238,10,0.9)',
                  boxShadow: '0 0 14px rgba(252,238,10,0.4), 0 0 28px rgba(252,238,10,0.15), inset 0 1px 0 rgba(255,255,255,0.4)',
                  color: '#000',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 0 0 1px rgba(252,238,10,0.4), 0 4px 16px rgba(0,0,0,0.4), 0 0 24px rgba(252,238,10,0.3), inset 0 1px 0 rgba(255,255,255,0.5)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 0 14px rgba(252,238,10,0.4), 0 0 28px rgba(252,238,10,0.15), inset 0 1px 0 rgba(255,255,255,0.4)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <Menu
                  className="h-5 w-5"
                  style={{ color: '#000' }}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Меню</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Logo — mobile only (desktop has sidebar) */}
        <div className="flex items-center gap-2 lg:hidden">
          <div
            className="flex h-7 w-7 items-center justify-center"
            style={{
              borderRadius: '6px',
              background: 'rgba(255,0,170,0.08)',
              border: '1px solid rgba(255,0,170,0.4)',
              boxShadow: '0 0 10px rgba(255,0,170,0.15)',
            }}
          >
            <Music
              className="h-3.5 w-3.5"
              style={{
                color: NEON_MAGENTA,
                filter: 'drop-shadow(0 0 3px rgba(255,0,170,0.6))',
              }}
            />
          </div>
          <span
            className="text-lg font-bold uppercase tracking-wider"
            style={{
              color: '#ffffff',
              fontFamily: FONT_DISPLAY,
              letterSpacing: '0.14em',
              textShadow: `0 0 8px rgba(${NEON_MAGENTA_RGB},0.4), 0 0 20px rgba(${NEON_CYAN_RGB},0.2)`,
            }}
          >
            SoundFlow
          </span>
        </div>

        {/* Breadcrumbs */}
        <nav
          className="hidden sm:flex items-center gap-1 text-sm min-w-0 flex-1"
          style={{ fontFamily: FONT_DISPLAY }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={breadcrumbs.map(b => b.label).join('/')}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-1 min-w-0"
            >
              {breadcrumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1 min-w-0">
                  {i > 0 && (
                    <ChevronRight
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: `rgba(${NEON_CYAN_RGB},0.4)` }}
                    />
                  )}
                  {crumb.view ? (
                    <button
                      onClick={() => navigate(crumb.view as ViewName, crumb.projectId)}
                      className="truncate max-w-[120px] transition-colors"
                      style={{
                        color: '#8892a0',
                        fontFamily: FONT_MONO,
                        fontSize: '11px',
                        letterSpacing: '0.5px',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = NEON_CYAN;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#8892a0';
                      }}
                    >
                      {crumb.label}
                    </button>
                  ) : (
                    <span
                      className={cn('truncate font-medium')}
                      style={{
                        color: i === breadcrumbs.length - 1 ? '#ffffff' : '#8892a0',
                        fontFamily: i === breadcrumbs.length - 1 ? FONT_DISPLAY : FONT_MONO,
                        fontSize: i === breadcrumbs.length - 1 ? '14px' : '11px',
                        letterSpacing: i === breadcrumbs.length - 1 ? '0.5px' : '0.5px',
                        textShadow:
                          i === breadcrumbs.length - 1
                            ? `0 0 6px rgba(${NEON_MAGENTA_RGB},0.3)`
                            : 'none',
                      }}
                    >
                      {crumb.label}
                    </span>
                  )}
                </span>
              ))}
            </motion.div>
          </AnimatePresence>
        </nav>

        {/* Spacer on mobile (breadcrumbs hidden) */}
        <div className="flex-1 sm:hidden" />

        {/* Contextual actions from views */}
        <div className="flex items-center gap-1.5">
          <AnimatePresence mode="popLayout">
            {headerActions.map((action) => (
              <motion.div
                key={action.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
              >
                <Button
                  size="sm"
                  variant={action.variant || 'outline'}
                  onClick={action.onClick}
                  className={cn('h-8 text-xs gap-1.5', action.className)}
                >
                  {action.icon}
                  <span className="hidden md:inline">{action.label}</span>
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Search — neon glassmorphism icon button (matches sidebar style).
            Active state (searchOpen) uses magenta glow + corner accent notch,
            same as the Home button's active state. */}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9 shrink-0 transition-all duration-200"
                style={{
                  borderRadius: '6px',
                  background:
                    searchOpen
                      ? 'rgba(255,0,170,0.18)'
                      : 'rgba(10,20,35,0.6)',
                  border:
                    searchOpen
                      ? '1px solid rgba(255,0,170,0.6)'
                      : '1px solid rgba(0,240,255,0.2)',
                  boxShadow:
                    searchOpen
                      ? '0 0 14px rgba(255,0,170,0.2), 0 0 4px rgba(0,240,255,0.15)'
                      : 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (!searchOpen) {
                    e.currentTarget.style.borderColor = 'rgba(0,240,255,0.6)';
                    e.currentTarget.style.boxShadow = '0 0 16px rgba(0,240,255,0.2), 0 0 4px rgba(255,0,170,0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!searchOpen) {
                    e.currentTarget.style.borderColor = 'rgba(0,240,255,0.2)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
                onClick={() => setSearchOpen(!searchOpen)}
              >
                <Search
                  className="h-4 w-4"
                  style={{
                    color: searchOpen ? NEON_MAGENTA : NEON_CYAN,
                    filter:
                      searchOpen
                        ? 'drop-shadow(0 0 4px rgba(255,0,170,0.7))'
                        : 'drop-shadow(0 0 3px rgba(0,240,255,0.5))',
                  }}
                />
                {searchOpen && (
                  <span
                    className="absolute -top-px -left-px h-1.5 w-1.5 rounded-[1px]"
                    style={{
                      background: NEON_MAGENTA,
                      boxShadow: '0 0 4px rgba(255,0,170,0.9)',
                    }}
                  />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Search</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Home button — neon glassmorphism (matches sidebar profile card style).
            Active state uses magenta glow + corner accent notch. */}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleHomeClick}
                aria-label="На главную"
                className="relative flex h-9 w-9 items-center justify-center transition-all duration-200 shrink-0"
                style={{
                  borderRadius: '6px',
                  background:
                    currentView === 'home'
                      ? 'rgba(255,0,170,0.18)'
                      : 'rgba(10,20,35,0.6)',
                  border:
                    currentView === 'home'
                      ? '1px solid rgba(255,0,170,0.6)'
                      : '1px solid rgba(0,240,255,0.2)',
                  boxShadow:
                    currentView === 'home'
                      ? '0 0 14px rgba(255,0,170,0.2), 0 0 4px rgba(0,240,255,0.15)'
                      : 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (currentView !== 'home') {
                    e.currentTarget.style.borderColor = 'rgba(255,0,170,0.5)';
                    e.currentTarget.style.boxShadow = '0 0 14px rgba(255,0,170,0.15), 0 0 4px rgba(0,240,255,0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentView !== 'home') {
                    e.currentTarget.style.borderColor = 'rgba(0,240,255,0.2)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >
                <Home
                  className="h-4 w-4"
                  style={{
                    color: currentView === 'home' ? NEON_MAGENTA : NEON_CYAN,
                    filter:
                      currentView === 'home'
                        ? 'drop-shadow(0 0 4px rgba(255,0,170,0.7))'
                        : 'drop-shadow(0 0 3px rgba(0,240,255,0.4))',
                  }}
                />
                {currentView === 'home' && (
                  <span
                    className="absolute -top-px -left-px h-1.5 w-1.5 rounded-[1px]"
                    style={{
                      background: NEON_MAGENTA,
                      boxShadow: '0 0 4px rgba(255,0,170,0.9)',
                    }}
                  />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>На главную</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Search overlay — neon glassmorphism dropdown */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute left-3 right-3 top-full mt-1 z-40 sm:left-auto sm:right-16 sm:w-80"
            >
              <div
                className="overflow-hidden"
                style={{
                  borderRadius: '12px',
                  background: 'rgba(10,14,23,0.95)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(0,240,255,0.3)',
                  boxShadow: '0 0 24px rgba(0,240,255,0.15), 0 0 8px rgba(255,0,170,0.1), 0 12px 40px rgba(0,0,0,0.7)',
                }}
              >
                <div
                  className="flex items-center gap-2 px-3 py-2.5"
                  style={{ borderBottom: '1px solid rgba(0,240,255,0.15)' }}
                >
                  <Search
                    className="h-4 w-4 shrink-0"
                    style={{ color: NEON_CYAN, filter: 'drop-shadow(0 0 3px rgba(0,240,255,0.5))' }}
                  />
                  <input
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); }
                      if (e.key === 'Enter' && searchResults.length > 0) handleSearchSelect(searchResults[0]);
                    }}
                    placeholder="Search projects, tracks…"
                    className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-slate-500"
                    style={{
                      color: '#ffffff',
                      fontFamily: FONT_MONO,
                    }}
                  />
                  <button
                    onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                    className="flex h-6 w-6 items-center justify-center transition-all duration-200"
                    style={{
                      borderRadius: '4px',
                      background: 'rgba(0,240,255,0.05)',
                      border: '1px solid rgba(0,240,255,0.3)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255,0,170,0.15)';
                      e.currentTarget.style.borderColor = 'rgba(255,0,170,0.8)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(0,240,255,0.05)';
                      e.currentTarget.style.borderColor = 'rgba(0,240,255,0.3)';
                    }}
                  >
                    <X className="h-3.5 w-3.5" style={{ color: NEON_CYAN }} />
                  </button>
                </div>
                {searchResults.length > 0 && (
                  <ScrollArea className="max-h-64">
                    <div className="p-1">
                      {searchResults.map((result) => (
                        <button
                          key={result.type + result.id}
                          onClick={() => handleSearchSelect(result)}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 transition-all duration-200 text-left"
                          style={{
                            borderRadius: '6px',
                            background: 'transparent',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(0,240,255,0.08)';
                            e.currentTarget.style.boxShadow = 'inset 2px 0 0 rgba(0,240,255,0.6)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          <div
                            className="flex w-7 h-7 items-center justify-center shrink-0"
                            style={{
                              borderRadius: '6px',
                              background:
                                result.type === 'project'
                                  ? 'rgba(255,0,170,0.08)'
                                  : 'rgba(0,240,255,0.08)',
                              border:
                                result.type === 'project'
                                  ? '1px solid rgba(255,0,170,0.3)'
                                  : '1px solid rgba(0,240,255,0.3)',
                            }}
                          >
                            {result.type === 'project' ? (
                              <FolderOpen className="h-3.5 w-3.5" style={{ color: NEON_MAGENTA }} />
                            ) : (
                              <Music className="h-3.5 w-3.5" style={{ color: NEON_CYAN }} />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p
                              className="text-xs font-medium truncate"
                              style={{ color: '#ffffff', fontFamily: FONT_DISPLAY }}
                            >
                              {result.title}
                            </p>
                            {result.subtitle && (
                              <p
                                className="text-[10px] truncate capitalize"
                                style={{ color: '#8892a0', fontFamily: FONT_MONO }}
                              >
                                {result.subtitle}
                              </p>
                            )}
                          </div>
                          <span
                            className="text-[9px] px-1.5 py-0.5 shrink-0 uppercase tracking-wider"
                            style={{
                              borderRadius: '4px',
                              background:
                                result.type === 'project'
                                  ? 'rgba(255,0,170,0.08)'
                                  : 'rgba(0,240,255,0.08)',
                              color: result.type === 'project' ? NEON_MAGENTA : NEON_CYAN,
                              fontFamily: FONT_MONO,
                            }}
                          >
                            {result.type}
                          </span>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
                {searchQuery && searchResults.length === 0 && (
                  <div className="p-6 text-center">
                    <p
                      className="text-xs"
                      style={{ color: '#8892a0', fontFamily: FONT_MONO }}
                    >
                      No results found
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notifications — neon glassmorphism icon button with magenta badge.
            Active state (notifOpen) uses magenta glow + corner accent notch,
            same as the Home button's active state. */}
        <div className="relative" ref={notifRef}>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 relative transition-all duration-200"
                  style={{
                    borderRadius: '6px',
                    background:
                      notifOpen
                        ? 'rgba(255,0,170,0.18)'
                        : 'rgba(10,20,35,0.6)',
                    border:
                      notifOpen
                        ? '1px solid rgba(255,0,170,0.6)'
                        : '1px solid rgba(0,240,255,0.2)',
                    boxShadow:
                      notifOpen
                        ? '0 0 14px rgba(255,0,170,0.2), 0 0 4px rgba(0,240,255,0.15)'
                        : 'none',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (!notifOpen) {
                      e.currentTarget.style.borderColor = 'rgba(0,240,255,0.6)';
                      e.currentTarget.style.boxShadow = '0 0 16px rgba(0,240,255,0.2), 0 0 4px rgba(255,0,170,0.15)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!notifOpen) {
                      e.currentTarget.style.borderColor = 'rgba(0,240,255,0.2)';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                  onClick={() => setNotifOpen(!notifOpen)}
                >
                  <Bell
                    className="h-4 w-4"
                    style={{
                      color: notifOpen ? NEON_MAGENTA : NEON_CYAN,
                      filter:
                        notifOpen
                          ? 'drop-shadow(0 0 4px rgba(255,0,170,0.7))'
                          : 'drop-shadow(0 0 3px rgba(0,240,255,0.5))',
                    }}
                  />
                  {notifOpen && (
                    <span
                      className="absolute -top-px -left-px h-1.5 w-1.5 rounded-[1px]"
                      style={{
                        background: NEON_MAGENTA,
                        boxShadow: '0 0 4px rgba(255,0,170,0.9)',
                      }}
                    />
                  )}
                  <AnimatePresence>
                    {notificationCount > 0 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center px-1 text-[9px] font-bold"
                        style={{
                          borderRadius: '4px',
                          background: NEON_MAGENTA,
                          color: '#ffffff',
                          fontFamily: FONT_MONO,
                          boxShadow: '0 0 8px rgba(255,0,170,0.6)',
                        }}
                      >
                        {notificationCount > 99 ? '99+' : notificationCount}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Notifications</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-80 z-50 overflow-hidden"
                style={{
                  borderRadius: '12px',
                  background: 'rgba(10,14,23,0.95)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(0,240,255,0.3)',
                  boxShadow: '0 0 24px rgba(0,240,255,0.15), 0 0 8px rgba(255,0,170,0.1), 0 12px 40px rgba(0,0,0,0.7)',
                }}
              >
                <div
                  className="flex items-center justify-between p-3"
                  style={{ borderBottom: '1px solid rgba(0,240,255,0.15)' }}
                >
                  <h3
                    className="text-sm font-semibold uppercase tracking-wider"
                    style={{
                      color: NEON_CYAN,
                      fontFamily: FONT_MONO,
                      textShadow: '0 0 6px rgba(0,240,255,0.4)',
                    }}
                  >
                    Notifications
                  </h3>
                  {notificationCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-[10px] uppercase tracking-wider transition-colors"
                      style={{
                        color: NEON_MAGENTA,
                        fontFamily: FONT_MONO,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#ffffff'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = NEON_MAGENTA; }}
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto custom-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center">
                      <Bell
                        className="mx-auto mb-2 h-6 w-6"
                        style={{ color: 'rgba(0,240,255,0.3)' }}
                      />
                      <p
                        className="text-xs"
                        style={{ color: '#8892a0', fontFamily: FONT_MONO }}
                      >
                        No notifications
                      </p>
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <button
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className="w-full text-left px-3 py-2.5 transition-all duration-200"
                        style={{
                          borderBottom: '1px solid rgba(0,240,255,0.08)',
                          background: notif.isRead ? 'transparent' : 'rgba(255,0,170,0.04)',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = notif.isRead
                            ? 'rgba(0,240,255,0.06)'
                            : 'rgba(255,0,170,0.08)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = notif.isRead
                            ? 'transparent'
                            : 'rgba(255,0,170,0.04)';
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className="mt-0.5 text-xs"
                            style={{
                              color: notif.isRead ? '#4a5568' : NEON_MAGENTA,
                              fontFamily: FONT_MONO,
                            }}
                          >
                            {notif.isRead ? '✓✓' : '✓'}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p
                              className="text-xs font-medium truncate"
                              style={{ color: '#ffffff', fontFamily: FONT_DISPLAY }}
                            >
                              {notif.title}
                            </p>
                            {notif.body && (
                              <p
                                className="text-[11px] truncate mt-0.5"
                                style={{ color: '#8892a0', fontFamily: FONT_MONO }}
                              >
                                {notif.body}
                              </p>
                            )}
                            <p
                              className="text-[10px] mt-1"
                              style={{ color: '#4a5568', fontFamily: FONT_MONO }}
                            >
                              {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Chat toggle moved to the bottom of the sidebar — see SidebarChatSection.
            The global <ProjectChat/> floating panel is rendered inside <AppSidebar/>. */}

        {/* Profile dropdown — neon glassmorphism avatar button (matches sidebar).
            Active state (profileOpen) uses magenta glow + corner accent notch,
            same as the Home button's active state. */}
        <Popover open={profileOpen} onOpenChange={setProfileOpen}>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button
                    className="relative flex items-center gap-2 pl-1 pr-2 py-1 shrink-0 transition-all duration-200"
                    style={{
                      borderRadius: '6px',
                      background:
                        profileOpen
                          ? 'rgba(255,0,170,0.18)'
                          : 'rgba(10,20,35,0.6)',
                      border:
                        profileOpen
                          ? '1px solid rgba(255,0,170,0.6)'
                          : '1px solid rgba(0,240,255,0.2)',
                      boxShadow:
                        profileOpen
                          ? '0 0 14px rgba(255,0,170,0.2), 0 0 4px rgba(0,240,255,0.15)'
                          : 'none',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      if (!profileOpen) {
                        e.currentTarget.style.borderColor = 'rgba(255,0,170,0.5)';
                        e.currentTarget.style.boxShadow = '0 0 14px rgba(255,0,170,0.15), 0 0 4px rgba(0,240,255,0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!profileOpen) {
                        e.currentTarget.style.borderColor = 'rgba(0,240,255,0.2)';
                        e.currentTarget.style.boxShadow = 'none';
                      }
                    }}
                  >
                    {profileOpen && (
                      <span
                        className="absolute -top-px -left-px h-1.5 w-1.5 rounded-[1px]"
                        style={{
                          background: NEON_MAGENTA,
                          boxShadow: '0 0 4px rgba(255,0,170,0.9)',
                        }}
                      />
                    )}
                    <div
                      className="relative h-7 w-7"
                      style={{
                        borderRadius: '4px',
                        padding: '1.5px',
                        background: NEON_MAGENTA,
                        boxShadow: '0 0 8px rgba(255,0,170,0.3)',
                      }}
                    >
                      <Avatar
                        className="h-full w-full"
                        style={{ borderRadius: '3px' }}
                      >
                        <AvatarImage src={user?.avatarUrl} alt={user?.displayName} />
                        <AvatarFallback
                          className="text-xs font-bold"
                          style={{
                            background: '#0a0e17',
                            color: NEON_MAGENTA,
                            fontFamily: FONT_DISPLAY,
                            textShadow: '0 0 6px rgba(255,0,170,0.6)',
                          }}
                        >
                          {user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <ChevronDown
                      className="h-3 w-3 hidden sm:block"
                      style={{
                        color: profileOpen ? NEON_MAGENTA : NEON_CYAN,
                        transform: profileOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 200ms ease, color 200ms ease',
                      }}
                    />
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Profile & Settings</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <PopoverContent
            align="end"
            className="w-64 p-0 border-0"
            style={{
              borderRadius: '12px',
              background: 'rgba(10,14,23,0.95)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(0,240,255,0.3)',
              boxShadow: '0 0 24px rgba(0,240,255,0.15), 0 0 8px rgba(255,0,170,0.1), 0 12px 40px rgba(0,0,0,0.7)',
            }}
          >
            <div
              className="p-3"
              style={{ borderBottom: '1px solid rgba(0,240,255,0.15)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center overflow-hidden"
                  style={{
                    borderRadius: '6px',
                    padding: '1.5px',
                    background: NEON_MAGENTA,
                    boxShadow: '0 0 10px rgba(255,0,170,0.3)',
                  }}
                >
                  <Avatar className="h-full w-full" style={{ borderRadius: '4px' }}>
                    <AvatarImage src={user?.avatarUrl} alt={user?.displayName} />
                    <AvatarFallback
                      className="text-sm font-bold"
                      style={{
                        background: '#0a0e17',
                        color: NEON_MAGENTA,
                        fontFamily: FONT_DISPLAY,
                        textShadow: '0 0 8px rgba(255,0,170,0.6)',
                      }}
                    >
                      {user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: '#ffffff', fontFamily: FONT_DISPLAY }}
                  >
                    {user?.displayName || 'User'}
                  </p>
                  <p
                    className="text-xs truncate"
                    style={{ color: '#8892a0', fontFamily: FONT_MONO }}
                  >
                    {user?.email || ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Group info */}
            <div
              className="p-3"
              style={{ borderBottom: '1px solid rgba(0,240,255,0.15)' }}
            >
              <p
                className="text-[10px] uppercase tracking-[1px] mb-1.5"
                style={{
                  color: NEON_CYAN,
                  fontFamily: FONT_MONO,
                  textShadow: '0 0 4px rgba(0,240,255,0.4)',
                }}
              >
                Group
              </p>
              <p
                className="text-sm font-medium truncate mb-1.5"
                style={{ color: '#ffffff', fontFamily: FONT_DISPLAY }}
              >
                {groupName}
              </p>
              {inviteCode && (
                <div className="flex items-center gap-1.5">
                  <code
                    className="flex-1 px-2 py-1 text-[10px] tracking-wider"
                    style={{
                      borderRadius: '6px',
                      background: 'rgba(10,20,35,0.6)',
                      border: '1px solid rgba(0,240,255,0.3)',
                      color: NEON_CYAN,
                      fontFamily: FONT_MONO,
                      textShadow: '0 0 6px rgba(0,240,255,0.4)',
                    }}
                  >
                    {inviteCode}
                  </code>
                  <button
                    className="flex h-7 w-7 items-center justify-center transition-all duration-200 shrink-0"
                    style={{
                      borderRadius: '6px',
                      background: 'rgba(0,240,255,0.05)',
                      border: '1px solid rgba(0,240,255,0.3)',
                      cursor: 'pointer',
                    }}
                    onClick={handleCopyCode}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255,0,170,0.15)';
                      e.currentTarget.style.borderColor = 'rgba(255,0,170,0.8)';
                      e.currentTarget.style.boxShadow = '0 0 12px rgba(255,0,170,0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(0,240,255,0.05)';
                      e.currentTarget.style.borderColor = 'rgba(0,240,255,0.3)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {copied ? (
                      <Check className="h-3 w-3" style={{ color: '#10B981' }} />
                    ) : (
                      <Copy className="h-3 w-3" style={{ color: NEON_CYAN }} />
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Menu items */}
            <div className="p-1.5">
              <button
                onClick={() => { setProfileOpen(false); navigate('group-settings'); }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 transition-all duration-200 text-left"
                style={{
                  borderRadius: '6px',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0,240,255,0.08)';
                  e.currentTarget.style.boxShadow = 'inset 2px 0 0 rgba(0,240,255,0.6)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <Settings
                  className="h-4 w-4"
                  style={{ color: NEON_MAGENTA }}
                />
                <span
                  className="text-sm"
                  style={{ color: '#ffffff', fontFamily: FONT_DISPLAY }}
                >
                  Settings
                </span>
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 transition-all duration-200 text-left"
                style={{
                  borderRadius: '6px',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,0,170,0.08)';
                  e.currentTarget.style.boxShadow = 'inset 2px 0 0 rgba(255,0,170,0.6)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <LogOut
                  className="h-4 w-4"
                  style={{ color: NEON_MAGENTA }}
                />
                <span
                  className="text-sm"
                  style={{ color: '#ffffff', fontFamily: FONT_DISPLAY }}
                >
                  Logout
                </span>
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </header>

      {/* Quick-access slide-down panel — renders OUTSIDE the header (so the
          header's clipPath doesn't clip it) but INSIDE a relative wrapper
          that spans the header's width. position: absolute anchors the panel
          to the wrapper's center (which matches the header center, accounting
          for the sidebar) rather than the viewport center.
          Animation: slides DOWN from the top edge of the header (large Y
          offset + opacity), like a drawer dropping out of the header. */}
      <AnimatePresence>
        {quickPanelOpen && (
          <>
            {/* Backdrop overlay — dims the rest of the screen so the panel
                stands out. Clicking the backdrop closes the panel. */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setQuickPanelOpen(false)}
              style={{
                position: 'fixed',
                top: '56px',
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(6, 8, 13, 0.7)',
                backdropFilter: 'blur(3px)',
                zIndex: 35,
              }}
            />
            <motion.div
              ref={quickPanelRef}
              initial={{ opacity: 0, y: -120, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -120, x: '-50%' }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'absolute',
              top: '54px',
              left: '50%',
              width: 'min(760px, calc(100vw - 32px))',
              zIndex: 40,
              transformOrigin: 'top center',
            }}
          >
            <div
              style={{
                position: 'relative',
                background: 'rgba(10,14,23,0.85)',
                backdropFilter: 'blur(16px)',
                borderRadius: '12px',
                boxShadow: '0 0 24px rgba(0,240,255,0.15), 0 0 8px rgba(255,0,170,0.1), 0 12px 40px rgba(0,0,0,0.7)',
                border: '1px solid rgba(0,240,255,0.3)',
                padding: '18px 20px 20px',
              }}
            >
              {/* ── Header bar ── */}
              <div className="flex items-center justify-between mb-5" style={{
                paddingBottom: '14px',
                borderBottom: '1px solid rgba(0,240,255,0.15)',
              }}>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center" style={{
                    borderRadius: '6px',
                    background: 'rgba(0,240,255,0.1)',
                    border: '1px solid rgba(0,240,255,0.5)',
                    boxShadow: '0 0 12px rgba(0,240,255,0.3)',
                  }}>
                    <Zap className="h-4 w-4" style={{ color: '#00f0ff', filter: 'drop-shadow(0 0 4px rgba(0,240,255,0.8))' }} />
                  </div>
                  <span className="text-sm font-bold uppercase" style={{
                    color: '#00f0ff',
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                    letterSpacing: '2px',
                    textShadow: '0 0 8px rgba(0,240,255,0.5)',
                  }}>
                    Быстрый доступ
                  </span>
                  <span className="text-[10px]" style={{
                    color: 'rgba(255,0,170,0.5)',
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                  }}>
                    · обзор группы
                  </span>
                </div>

                {/* Close button */}
                <button
                  onClick={() => setQuickPanelOpen(false)}
                  className="group flex h-8 w-8 items-center justify-center transition-all"
                  style={{
                    borderRadius: '6px',
                    background: 'rgba(0,240,255,0.05)',
                    border: '1px solid rgba(0,240,255,0.3)',
                    cursor: 'pointer',
                  }}
                  title="Закрыть (Esc)"
                  aria-label="Закрыть"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,0,170,0.15)';
                    e.currentTarget.style.borderColor = 'rgba(255,0,170,0.8)';
                    e.currentTarget.style.boxShadow = '0 0 12px rgba(255,0,170,0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(0,240,255,0.05)';
                    e.currentTarget.style.borderColor = 'rgba(0,240,255,0.3)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <X className="h-4 w-4" style={{ color: '#00f0ff' }} />
                </button>
              </div>

              {/* Stats row — yellow accent buttons (matches "Новый проект" style) */}
              <div className="grid grid-cols-4 gap-3 mb-5">
                {[
                  { icon: FolderKanban, value: projects.length, label: 'Проекты', view: 'projects' as ViewName },
                  { icon: Music2, value: tracks.length, label: 'Треки', view: 'projects' as ViewName },
                  { icon: Lightbulb, value: ideas.length, label: 'Идеи', view: 'ideas' as ViewName },
                  { icon: Users, value: memberCount, label: 'Участники', view: 'group-settings' as ViewName },
                ].map((s) => (
                  <button
                    key={s.label}
                    onClick={() => { navigate(s.view); setQuickPanelOpen(false); }}
                    className="group flex flex-col items-center justify-center gap-2 py-4 transition-all duration-200"
                    style={{
                      clipPath: 'polygon(0 0, calc(100% - 7px) 0, 100% 7px, 100% 100%, 7px 100%, 0 calc(100% - 7px))',
                      background: 'linear-gradient(135deg, #FCEE0A, #F1F100 50%, #FCEE0A)',
                      border: '1.5px solid rgba(252,238,10,0.9)',
                      boxShadow: '0 0 14px rgba(252,238,10,0.4), 0 0 28px rgba(252,238,10,0.15), inset 0 1px 0 rgba(255,255,255,0.4)',
                      cursor: 'pointer',
                      padding: '16px 8px',
                    }}
                    title={`Перейти к: ${s.label}`}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.color = '#FCEE0A';
                      e.currentTarget.style.border = '1.5px solid #FCEE0A';
                      e.currentTarget.style.boxShadow = '0 0 0 1px rgba(252,238,10,0.4), 0 4px 16px rgba(0,0,0,0.4), 0 0 24px rgba(252,238,10,0.25), inset 0 1px 0 rgba(255,255,255,0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.color = '';
                      e.currentTarget.style.border = '1.5px solid rgba(252,238,10,0.9)';
                      e.currentTarget.style.boxShadow = '0 0 14px rgba(252,238,10,0.4), 0 0 28px rgba(252,238,10,0.15), inset 0 1px 0 rgba(255,255,255,0.4)';
                    }}
                  >
                    {/* Icon — black on yellow */}
                    <s.icon className="h-5 w-5 transition-transform group-hover:scale-110" style={{ color: '#000' }} />

                    {/* Count — black with white text-shadow */}
                    <span className="text-2xl font-bold tabular-nums leading-none" style={{
                      color: '#000',
                      fontFamily: 'var(--font-rajdhani), sans-serif',
                      textShadow: '0 1px 0 rgba(255,255,255,0.3)',
                    }}>
                      {s.value}
                    </span>

                    {/* Label — black, uppercase mono */}
                    <span className="text-[10px] uppercase font-bold tracking-wider" style={{
                      color: '#000',
                      fontFamily: 'var(--font-jetbrains-mono), monospace',
                      letterSpacing: '0.5px',
                      opacity: 0.75,
                    }}>
                      {s.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Quick-access cards section header */}
              {quickAccessCards.length > 0 && (
                <div className="flex items-center gap-2 mb-3">
                  <LayoutDashboard className="h-4 w-4" style={{ color: '#00f0ff', filter: 'drop-shadow(0 0 4px rgba(0,240,255,0.6))' }} />
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{
                    color: '#00f0ff',
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                    letterSpacing: '1px',
                    textShadow: '0 0 6px rgba(0,240,255,0.4)',
                  }}>
                    Проекты
                  </span>
                  <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(0,240,255,0.3), transparent)' }} />
                </div>
              )}

              {/* Quick-access cards — glassmorphism neon carousel */}
              {quickAccessCards.length > 0 ? (
                <div className="flex items-center gap-2">
                  {/* Left scroll button — yellow accent style */}
                  <button
                    onClick={() => {
                      const el = quickCardsScrollRef.current;
                      if (el) el.scrollBy({ left: -220, behavior: 'smooth' });
                    }}
                    className="group flex h-12 w-8 shrink-0 items-center justify-center transition-all duration-200"
                    style={{
                      clipPath: YELLOW_BTN_CLIP,
                      background: 'linear-gradient(135deg, #FCEE0A, #F1F100 50%, #FCEE0A)',
                      border: '1.5px solid rgba(252,238,10,0.9)',
                      boxShadow: '0 0 12px rgba(252,238,10,0.4), inset 0 1px 0 rgba(255,255,255,0.4)',
                      cursor: 'pointer',
                    }}
                    title="Прокрутить влево"
                    aria-label="Прокрутить влево"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 0 16px rgba(252,238,10,0.6), 0 0 24px rgba(252,238,10,0.2), inset 0 1px 0 rgba(255,255,255,0.5)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '0 0 12px rgba(252,238,10,0.4), inset 0 1px 0 rgba(255,255,255,0.4)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <ChevronLeft className="h-4 w-4" style={{ color: '#000' }} />
                  </button>

                  {/* Scrollable cards container */}
                  <div
                    ref={quickCardsScrollRef}
                    className="flex gap-3 overflow-x-auto pb-1 flex-1 hide-scrollbar"
                    style={{ scrollBehavior: 'smooth', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {quickAccessCards.map((card) => {
                      const stLabel: Record<string, string> = {
                        in_progress: 'В работе', mixing: 'Сведение', mastering: 'Мастеринг', released: 'Релиз', todo: 'TODO',
                      };
                      const sl = stLabel[card.status] || card.status;
                      const typeLabels: Record<string, string> = {
                        album: 'Альбом', ep: 'EP', single: 'Сингл', general: 'Канбан',
                      };
                      const tl = typeLabels[card.type] || 'Проект';
                      const count = card.kind === 'auto' ? card.trackCount : card.boardCount;
                      const progress = card.kind === 'auto'
                        ? (count > 0 ? 50 : 10)
                        : (count > 0 ? 40 : 10);
                      return (
                        <div
                          key={card.id}
                          onClick={() => {
                            if (card.kind === 'auto') {
                              navigate('project-detail', card.id);
                            } else {
                              useKanbanStore.getState().selectProject(card.id);
                              navigate('kanban');
                            }
                            setQuickPanelOpen(false);
                          }}
                          className="group relative w-52 shrink-0 cursor-pointer overflow-hidden transition-all duration-200"
                          style={{
                            borderRadius: '8px',
                            background: 'rgba(10,20,35,0.6)',
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(0,240,255,0.2)',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-3px)';
                            e.currentTarget.style.borderColor = 'rgba(255,0,170,0.5)';
                            e.currentTarget.style.boxShadow = '0 0 20px rgba(255,0,170,0.15), 0 0 6px rgba(0,240,255,0.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.borderColor = 'rgba(0,240,255,0.2)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                          title={`Открыть: ${card.title}`}
                        >
                          {/* Top accent strip — cyan */}
                          <div
                            className="h-[2px] w-full"
                            style={{
                              background: 'linear-gradient(90deg, transparent, #00f0ff 30%, #00f0ff 70%, transparent)',
                              boxShadow: '0 0 6px rgba(0,240,255,0.6)',
                            }}
                          />
                          {/* Body */}
                          <div className="p-3.5 relative">
                            {/* Type icon + label */}
                            <div className="mb-2.5 flex items-center gap-2">
                              <div
                                className="flex h-7 w-7 items-center justify-center"
                                style={{
                                  borderRadius: '6px',
                                  background: 'rgba(255,0,170,0.08)',
                                  border: '1px solid rgba(255,0,170,0.3)',
                                }}
                              >
                                {card.kind === 'auto' ? (
                                  <FolderOpen className="w-3.5 h-3.5" style={{ color: '#ff00aa', filter: 'drop-shadow(0 0 3px rgba(255,0,170,0.6))' }} />
                                ) : (
                                  <LayoutDashboard className="w-3.5 h-3.5" style={{ color: '#ff00aa', filter: 'drop-shadow(0 0 3px rgba(255,0,170,0.6))' }} />
                                )}
                              </div>
                              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{
                                color: '#ff00aa',
                                fontFamily: 'var(--font-jetbrains-mono), monospace',
                                letterSpacing: '0.5px',
                                textShadow: '0 0 4px rgba(255,0,170,0.4)',
                              }}>
                                {tl}
                              </span>
                            </div>
                            {/* Title */}
                            <p className="text-sm font-semibold line-clamp-1" style={{
                              color: '#ffffff',
                              fontFamily: 'var(--font-rajdhani), sans-serif',
                            }}>
                              {card.title}
                            </p>
                            {/* Meta — status dot + count */}
                            <div className="mt-1.5 flex items-center gap-2 text-[11px]" style={{
                              color: '#8892a0',
                              fontFamily: 'var(--font-jetbrains-mono), monospace',
                            }}>
                              <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#ff00aa', boxShadow: '0 0 4px rgba(255,0,170,0.6)' }} />
                                {sl}
                              </span>
                              <span>·</span>
                              <span className="flex items-center gap-1">
                                {card.kind === 'auto' ? (
                                  <Music2 className="w-3 h-3" style={{ color: '#00f0ff' }} />
                                ) : (
                                  <Layers className="w-3 h-3" style={{ color: '#00f0ff' }} />
                                )}
                                {count}
                              </span>
                            </div>
                            {/* Waveform progress bar */}
                            <div className="mt-2.5">
                              <WaveformProgressBar progress={progress} accentColor="#ff00aa" height={18} bars={20} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Right scroll button — yellow accent style */}
                  <button
                    onClick={() => {
                      const el = quickCardsScrollRef.current;
                      if (el) el.scrollBy({ left: 220, behavior: 'smooth' });
                    }}
                    className="group flex h-12 w-8 shrink-0 items-center justify-center transition-all duration-200"
                    style={{
                      clipPath: YELLOW_BTN_CLIP,
                      background: 'linear-gradient(135deg, #FCEE0A, #F1F100 50%, #FCEE0A)',
                      border: '1.5px solid rgba(252,238,10,0.9)',
                      boxShadow: '0 0 12px rgba(252,238,10,0.4), inset 0 1px 0 rgba(255,255,255,0.4)',
                      cursor: 'pointer',
                    }}
                    title="Прокрутить вправо"
                    aria-label="Прокрутить вправо"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 0 16px rgba(252,238,10,0.6), 0 0 24px rgba(252,238,10,0.2), inset 0 1px 0 rgba(255,255,255,0.5)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '0 0 12px rgba(252,238,10,0.4), inset 0 1px 0 rgba(255,255,255,0.4)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <ChevronRight className="h-4 w-4" style={{ color: '#000' }} />
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm" style={{ color: '#8892a0', fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                    Нет проектов в избранном. Добавьте их на главной странице.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
          </>
        )}
      </AnimatePresence>
      </div>
    </>
  );
}

