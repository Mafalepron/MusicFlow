'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, Bell, Menu, ChevronRight, ChevronDown,
  MessageCircle, LogOut, Settings, User, Check, Copy,
  Home, Lightbulb, FolderOpen, LayoutGrid, Music,
  FolderKanban, Music2, Users, Zap, LayoutDashboard,
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
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNavigationStore, useAuthStore, useDataStore, type ViewName } from '@/lib/store';
import { useHeaderActionsStore } from '@/store/header-actions-store';
import { useChatContextStore } from '@/store/chat-context-store';
import { useChatUIStore } from '@/store/chat-ui-store';
import { useChatUnread } from '@/components/chat/project-chat';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const viewLabels: Record<string, string> = {
  home: 'Home',
  ideas: 'Ideas',
  projects: 'Projects',
  'project-detail': 'Project',
  'track-detail': 'Track',
  kanban: 'Kanban',
  'group-settings': 'Settings',
};

const navItems: { icon: typeof Home; label: string; view: ViewName }[] = [
  { icon: Home, label: 'Home', view: 'home' },
  { icon: Lightbulb, label: 'Ideas', view: 'ideas' },
  { icon: FolderOpen, label: 'Projects', view: 'projects' },
  { icon: LayoutGrid, label: 'Kanban', view: 'kanban' },
];

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
  const { activeChatProjectId, activeChatProjectName } = useChatContextStore();
  const { isOpen: chatOpen, toggle: toggleChat } = useChatUIStore();
  const chatUnread = useChatUnread();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ type: 'project' | 'track'; id: string; title: string; subtitle?: string }[]>([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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

  // Fetch member count whenever the group changes (used by the quick panel).
  useEffect(() => {
    if (!currentGroupId) return;
    fetch(`/api/groups/${currentGroupId}/members`)
      .then((r) => r.json())
      .then((m) => setMemberCount(Array.isArray(m) ? m.length : 0))
      .catch(() => {});
  }, [currentGroupId]);

  // Close the quick-access panel when the user clicks outside it or presses Escape.
  const quickPanelRef = useRef<HTMLDivElement>(null);
  const quickStripeRef = useRef<HTMLButtonElement>(null);
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

  // Build breadcrumbs
  const breadcrumbs: { label: string; view?: string; projectId?: string }[] = [
    { label: groupName },
  ];

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

  const handleNavigate = (view: ViewName) => {
    navigate(view);
    setMobileNavOpen(false);
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
      {/* Unified Header — custom dark cybernetic bar with chamfered bottom */}
      <header
        className="flex h-14 items-center gap-2 px-3 lg:px-6"
        style={{
          background: '#0f121a',
          clipPath: 'polygon(0 0, 100% 0, 98% 100%, 2% 100%)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}
      >
        {/* Embedded neon-purple line centered in header — CLICKABLE button
            that opens a quick-access slide-down panel (projects, tracks,
            ideas, participants). The stripe pulses + scales on hover so it
            reads as interactive. */}
        <button
          ref={quickStripeRef}
          onClick={() => setQuickPanelOpen((o) => !o)}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 group flex items-center justify-center"
          style={{ width: '180px', height: '24px', background: 'transparent', border: 'none', cursor: 'pointer' }}
          title="Быстрый доступ — проекты, треки, идеи, участники"
          aria-label="Открыть панель быстрого доступа"
        >
          <div
            className="pointer-events-none transition-all duration-200 group-hover:scale-x-110 group-hover:opacity-100"
            style={{
              width: '120px',
              height: '2px',
              background: '#9d4edd',
              boxShadow: quickPanelOpen
                ? '0 0 14px #9d4edd, 0 0 6px #9d4edd, 0 0 2px #c77dff'
                : '0 0 10px #9d4edd, 0 0 4px #9d4edd',
              opacity: quickPanelOpen ? 1 : 0.8,
            }}
          />
          {/* Tiny chevron indicator — flips direction when the panel is open */}
          <ChevronDown
            className="absolute left-1/2 top-full -translate-x-1/2 transition-transform duration-200 group-hover:opacity-100"
            style={{
              color: '#9d4edd',
              width: '12px',
              height: '12px',
              opacity: 0.7,
              transform: quickPanelOpen ? 'translate(-50%, -2px) rotate(180deg)' : 'translate(-50%, -2px)',
              filter: 'drop-shadow(0 0 3px rgba(157,78,221,0.6))',
            }}
          />
        </button>

        {/* Quick-access slide-down panel — rendered OUTSIDE the header (after
            </header>) via a fixed-position overlay so the header's clipPath
            doesn't clip it. See the AnimatePresence block below the header. */}

        {/* Mobile: hamburger menu */}
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-9 w-9 hover:bg-[#1E1E28] shrink-0"
              style={{ color: '#00a8c6' }}
            >
              <Menu className="h-5 w-5" style={{ filter: 'drop-shadow(0 0 4px rgba(0,168,198,0.25))' }} />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <MobileNavContent
              currentView={currentView}
              onNavigate={handleNavigate}
              groupName={groupName}
              inviteCode={inviteCode}
              user={user}
              onCopyCode={handleCopyCode}
              copied={copied}
              onLogout={handleLogout}
              notificationCount={notificationCount}
            />
          </SheetContent>
        </Sheet>

        {/* Logo — mobile only (desktop has sidebar) */}
        <div className="flex items-center gap-2 lg:hidden">
          <div className="relative flex h-7 w-7 items-center justify-center">
            {/* Holographic double-ring icon */}
            <div className="absolute inset-0 rounded-full" style={{ border: '1.5px solid #00a8c6', boxShadow: '0 0 8px rgba(0,168,198,0.25)' }} />
            <div className="absolute inset-[3px] rounded-full" style={{ border: '1px solid #7b2cbf', boxShadow: '0 0 6px rgba(123,44,191,0.25)' }} />
            <Music className="h-3 w-3 relative" style={{ color: '#00a8c6', filter: 'drop-shadow(0 0 2px rgba(0,168,198,0.25))' }} />
          </div>
          <span className="text-lg font-bold" style={{
            color: '#00a8c6',
            fontFamily: 'var(--font-rajdhani), sans-serif',
            letterSpacing: '0.06em',
            textShadow: '0 0 8px rgba(0,168,198,0.25)',
          }}>SoundFlow</span>
        </div>

        {/* Breadcrumbs */}
        <nav className="hidden sm:flex items-center gap-1 text-sm min-w-0 flex-1" style={{ fontFamily: 'var(--font-rajdhani), sans-serif' }}>
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
                  {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />}
                  {crumb.view ? (
                    <button
                      onClick={() => navigate(crumb.view as ViewName, crumb.projectId)}
                      className="text-muted-foreground hover:text-foreground transition-colors truncate max-w-[120px]"
                    >
                      {crumb.label}
                    </button>
                  ) : (
                    <span className={cn(
                      'font-medium truncate',
                      i === breadcrumbs.length - 1 ? 'text-foreground' : 'text-muted-foreground'
                    )}>
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

        {/* Search — recessed square icon frame */}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 hover:text-[#00a8c6] shrink-0 transition-all"
                style={{
                  background: '#161a24',
                  border: '1px solid #232a3b',
                  borderRadius: '4px',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#00a8c6'; e.currentTarget.style.boxShadow = '0 0 8px rgba(0,168,198,0.25)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1a202c'; e.currentTarget.style.boxShadow = 'none'; }}
                onClick={() => setSearchOpen(!searchOpen)}
              >
                <Search className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Search</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Search overlay */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute left-3 right-3 top-full mt-1 z-40 sm:left-auto sm:right-16 sm:w-80"
            >
              <div className="rounded-xl border border-border bg-card shadow-2xl shadow-black/40 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
                  <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                  <input
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); }
                      if (e.key === 'Enter' && searchResults.length > 0) handleSearchSelect(searchResults[0]);
                    }}
                    placeholder="Search projects, tracks..."
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {searchResults.length > 0 && (
                  <ScrollArea className="max-h-64">
                    <div className="p-1">
                      {searchResults.map((result) => (
                        <button
                          key={result.type + result.id}
                          onClick={() => handleSearchSelect(result)}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-[#1E1E28] transition-colors text-left"
                        >
                          <div className={cn(
                            'w-7 h-7 rounded-md flex items-center justify-center shrink-0',
                            result.type === 'project' ? 'bg-primary/15' : 'bg-[#00a8c6]/15'
                          )}>
                            {result.type === 'project'
                              ? <FolderOpen className="h-3.5 w-3.5 text-primary" />
                              : <Music className="h-3.5 w-3.5 text-[#00a8c6]" />
                            }
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-foreground truncate">{result.title}</p>
                            {result.subtitle && (
                              <p className="text-[10px] text-muted-foreground truncate capitalize">{result.subtitle}</p>
                            )}
                          </div>
                          <span className={cn(
                            'text-[9px] px-1.5 py-0.5 rounded shrink-0',
                            result.type === 'project' ? 'bg-primary/15 text-primary' : 'bg-[#00a8c6]/15 text-[#00a8c6]'
                          )}>
                            {result.type}
                          </span>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
                {searchQuery && searchResults.length === 0 && (
                  <div className="p-6 text-center">
                    <p className="text-xs text-muted-foreground">No results found</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notifications — recessed square icon frame with purple alert badge */}
        <div className="relative" ref={notifRef}>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 hover:text-[#00a8c6] shrink-0 relative transition-all"
                  style={{
                    background: '#161a24',
                    border: '1px solid #232a3b',
                    borderRadius: '4px',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#00a8c6'; e.currentTarget.style.boxShadow = '0 0 8px rgba(0,168,198,0.25)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1a202c'; e.currentTarget.style.boxShadow = 'none'; }}
                  onClick={() => setNotifOpen(!notifOpen)}
                >
                  <Bell className="h-4 w-4" />
                  <AnimatePresence>
                    {notificationCount > 0 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold"
                        style={{
                          background: '#7b2cbf',
                          color: '#fff',
                          boxShadow: '0 0 6px rgba(123,44,191,0.25)',
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
                className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-card shadow-2xl shadow-black/60 z-50 overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-border p-3">
                  <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
                  {notificationCount > 0 && (
                    <button onClick={markAllRead} className="text-[10px] text-primary hover:underline">Mark all read</button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center">
                      <Bell className="mx-auto mb-2 h-6 w-6 text-muted-foreground/30" />
                      <p className="text-xs text-muted-foreground">No notifications</p>
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <button
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={cn(
                          'w-full text-left px-3 py-2.5 border-b border-border/50 last:border-0 transition-colors hover:bg-[#1E1E28]',
                          !notif.isRead && 'bg-primary/5'
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <span className={cn('mt-0.5 text-xs', notif.isRead ? 'text-muted-foreground/40' : 'text-primary')}>
                            {notif.isRead ? '✓✓' : '✓'}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-foreground truncate">{notif.title}</p>
                            {notif.body && <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">{notif.body}</p>}
                            <p className="text-[10px] text-muted-foreground/40 mt-1">
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

        {/* Chat toggle — recessed square icon frame */}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleChat}
                disabled={!activeChatProjectId}
                className={cn(
                  'relative h-9 w-9 flex items-center justify-center transition-all duration-200 shrink-0',
                  chatOpen
                    ? 'text-cyan-400'
                    : activeChatProjectId
                      ? 'text-muted-foreground hover:text-cyan-400'
                      : 'text-muted-foreground/40 cursor-not-allowed',
                )}
                style={{
                  background: '#161a24',
                  border: chatOpen ? '1px solid #00a8c6' : '1px solid #1a202c',
                  borderRadius: '4px',
                  boxShadow: chatOpen ? '0 0 8px rgba(0,168,198,0.25)' : 'none',
                }}
                onMouseEnter={(e) => { if (activeChatProjectId && !chatOpen) { e.currentTarget.style.borderColor = '#00a8c6'; e.currentTarget.style.boxShadow = '0 0 8px rgba(0,168,198,0.25)'; } }}
                onMouseLeave={(e) => { if (!chatOpen) { e.currentTarget.style.borderColor = '#1a202c'; e.currentTarget.style.boxShadow = 'none'; } }}
              >
                {/* Pulsing aura when there are unread messages */}
                {chatUnread > 0 && !chatOpen && activeChatProjectId && (
                  <span className="absolute inset-0 rounded-lg bg-cyan-500/20 animate-ping" style={{ animationDuration: '2s' }} />
                )}
                <MessageCircle className={cn('h-4 w-4 relative transition-transform', chatOpen && 'scale-90')} />
                {/* Unread badge */}
                {chatUnread > 0 && !chatOpen && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 px-1 text-[9px] font-bold text-white shadow-lg shadow-cyan-500/30"
                  >
                    {chatUnread > 9 ? '9+' : chatUnread}
                  </motion.span>
                )}
                {/* Active project indicator dot */}
                {activeChatProjectId && !chatOpen && chatUnread === 0 && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-background" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {activeChatProjectId
                ? chatOpen ? 'Close chat' : `Chat: ${activeChatProjectName || 'project'}`
                : 'Select a project to chat'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Profile dropdown — hexagonal avatar with cyan border */}
        <Popover open={profileOpen} onOpenChange={setProfileOpen}>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-2 pl-1 pr-2 py-1 hover:bg-white/[0.04] transition-colors shrink-0">
                    <div className="relative h-7 w-7" style={{
                      clipPath: 'polygon(30% 0%, 70% 0%, 100% 50%, 70% 100%, 30% 100%, 0% 50%)',
                      padding: '1.5px',
                      background: '#00a8c6',
                    }}>
                      <Avatar className="h-full w-full" style={{
                        clipPath: 'polygon(30% 0%, 70% 0%, 100% 50%, 70% 100%, 30% 100%, 0% 50%)',
                        borderRadius: 0,
                      }}>
                        <AvatarImage src={user?.avatarUrl} alt={user?.displayName} />
                        <AvatarFallback className="bg-[#161a24] text-[#00a8c6] text-xs">
                          {user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Profile & Settings</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <PopoverContent align="end" className="w-64 p-0 bg-card border-border">
            <div className="p-3 border-b border-border">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user?.avatarUrl} alt={user?.displayName} />
                  <AvatarFallback className="bg-primary/20 text-primary">
                    {user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {user?.displayName || 'User'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.email || ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Group info */}
            <div className="p-3 border-b border-border">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1.5">Group</p>
              <p className="text-sm font-medium text-foreground truncate mb-1.5">{groupName}</p>
              {inviteCode && (
                <div className="flex items-center gap-1.5">
                  <code className="flex-1 rounded bg-background px-2 py-1 text-xs text-[#00a8c6] font-mono">
                    {inviteCode}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 hover:bg-[#2A2A36] shrink-0"
                    onClick={handleCopyCode}
                  >
                    {copied ? <Check className="h-3 w-3 text-[#10B981]" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                  </Button>
                </div>
              )}
            </div>

            {/* Menu items */}
            <div className="p-1.5">
              <button
                onClick={() => { setProfileOpen(false); navigate('group-settings'); }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-[#1E1E28] transition-colors text-left"
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">Settings</span>
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-[#1E1E28] transition-colors text-left"
              >
                <LogOut className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">Logout</span>
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </header>

      {/* Quick-access slide-down panel — rendered OUTSIDE the header (so the
          header's clipPath doesn't clip it) but INSIDE a relative wrapper
          that spans the header's width. position: absolute anchors the panel
          to the wrapper's center (which matches the header center, accounting
          for the sidebar) rather than the viewport center. */}
      <AnimatePresence>
        {quickPanelOpen && (
          <motion.div
            ref={quickPanelRef}
            initial={{ opacity: 0, y: -8, scaleY: 0.96 }}
            animate={{ opacity: 1, y: 0, scaleY: 1, x: '-50%' }}
            exit={{ opacity: 0, y: -8, scaleY: 0.96 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: '56px',
              left: '50%',
              width: 'min(720px, calc(100vw - 32px))',
              zIndex: 40,
              transformOrigin: 'top center',
            }}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, #11141d 0%, #0c0e16 100%)',
                border: '1px solid rgba(157,78,221,0.4)',
                clipPath: 'polygon(0 6px, 6px 0, calc(100% - 6px) 0, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0 calc(100% - 6px))',
                boxShadow: '0 0 18px rgba(157,78,221,0.25), 0 8px 24px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.05)',
                padding: '16px 18px',
                position: 'relative',
              }}
            >
              {/* Close button */}
              <button
                onClick={() => setQuickPanelOpen(false)}
                className="absolute top-2 right-3 flex h-6 w-6 items-center justify-center text-muted-foreground hover:text-[#c7a008] transition-colors"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                aria-label="Закрыть"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              {/* Stats row — projects / tracks / ideas / participants */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[
                  { icon: FolderKanban, value: projects.length, label: 'Проекты', color: '#c7a008', view: 'projects' as ViewName },
                  { icon: Music2, value: tracks.length, label: 'Треки', color: '#00a8c6', view: 'projects' as ViewName },
                  { icon: Lightbulb, value: ideas.length, label: 'Идеи', color: '#718096', view: 'ideas' as ViewName },
                  { icon: Users, value: memberCount, label: 'Участники', color: '#4a8d6f', view: 'group-settings' as ViewName },
                ].map((s) => (
                  <button
                    key={s.label}
                    onClick={() => { navigate(s.view); setQuickPanelOpen(false); }}
                    className="group flex flex-col items-center justify-center gap-1 py-2 transition-all hover:scale-105"
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: `1px solid ${s.color}33`,
                      clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))',
                      cursor: 'pointer',
                      padding: '6px 4px',
                    }}
                    title={`Перейти к: ${s.label}`}
                  >
                    <s.icon className="h-4 w-4" style={{ color: s.color, filter: `drop-shadow(0 0 3px ${s.color}66)` }} />
                    <span className="text-lg font-bold tabular-nums" style={{ color: '#e2e8f0', fontFamily: 'var(--font-rajdhani), sans-serif' }}>
                      {s.value}
                    </span>
                    <span className="text-[9px] uppercase font-bold tracking-wider" style={{ color: s.color, fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                      {s.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Quick-access cards — first 6 projects */}
              {projects.length > 0 ? (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Zap className="h-3 w-3" style={{ color: '#c7a008', filter: 'drop-shadow(0 0 2px rgba(199,160,8,0.6))' }} />
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#c7a008', fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                      Быстрый доступ · Проекты
                    </span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(199,160,8,0.4) transparent' }}>
                    {projects.slice(0, 6).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { navigate('project-detail', p.id); setQuickPanelOpen(false); }}
                        className="group relative shrink-0 w-44 text-left p-2 transition-all hover:scale-[1.03]"
                        style={{
                          background: 'rgba(0,168,198,0.06)',
                          border: '1px solid rgba(0,168,198,0.3)',
                          clipPath: 'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))',
                          cursor: 'pointer',
                        }}
                        title={`Открыть: ${p.title}`}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <FolderOpen className="h-3 w-3 shrink-0" style={{ color: '#00a8c6' }} />
                          <span className="text-[10px] font-bold uppercase tracking-wider truncate" style={{ color: '#00a8c6', fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                            {p.type || 'project'}
                          </span>
                        </div>
                        <p className="text-xs font-semibold truncate" style={{ color: '#e2e8f0', fontFamily: 'var(--font-rajdhani), sans-serif' }}>
                          {p.title}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[9px]" style={{ color: '#718096', fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                            {p.status || 'draft'}
                          </span>
                          <LayoutDashboard className="h-2.5 w-2.5 opacity-50 group-hover:opacity-100 transition-opacity" style={{ color: '#c7a008' }} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-xs" style={{ color: '#718096', fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                    Нет проектов. Создайте первый на главной странице.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </>
  );
}

// Mobile nav content (shared between Sheet and could be reused)
function MobileNavContent({
  currentView,
  onNavigate,
  groupName,
  inviteCode,
  user,
  onCopyCode,
  copied,
  onLogout,
  notificationCount,
}: {
  currentView: string;
  onNavigate: (view: ViewName) => void;
  groupName: string;
  inviteCode: string;
  user: { displayName?: string; email?: string; avatarUrl?: string } | null;
  onCopyCode: () => void;
  copied: boolean;
  onLogout: () => void;
  notificationCount: number;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
          <Music className="h-4 w-4 text-primary" />
        </div>
        <span className="text-lg font-bold text-primary">SoundFlow</span>
      </div>

      <Separator className="bg-border" />

      {/* Group info */}
      <div className="px-3 py-3">
        <div className="rounded-lg bg-[#1E1E28] p-3">
          <p className="text-sm font-medium text-foreground truncate">{groupName}</p>
          {inviteCode && (
            <div className="mt-2 flex items-center gap-1.5">
              <code className="flex-1 rounded bg-background px-2 py-0.5 text-xs text-[#00a8c6] font-mono">
                {inviteCode}
              </code>
              <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-[#2A2A36]" onClick={onCopyCode}>
                {copied ? <Check className="h-3 w-3 text-[#10B981]" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-2">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = currentView === item.view ||
              (item.view === 'projects' && (currentView === 'project-detail' || currentView === 'track-detail'));
            return (
              <button
                key={item.view}
                onClick={() => onNavigate(item.view)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors border-l-2',
                  isActive
                    ? 'bg-primary/10 text-primary border-primary'
                    : 'text-muted-foreground hover:bg-[#1E1E28] hover:text-foreground border-transparent'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
                {item.view === 'projects' && notificationCount > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[9px] font-bold text-primary-foreground">
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </span>
                )}
              </button>
            );
          })}

          <button
            onClick={() => onNavigate('group-settings')}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors border-l-2',
              currentView === 'group-settings'
                ? 'bg-primary/10 text-primary border-primary'
                : 'text-muted-foreground hover:bg-[#1E1E28] hover:text-foreground border-transparent'
            )}
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
        </nav>
      </ScrollArea>

      {/* User Section */}
      <Separator className="bg-border" />
      <div className="p-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.avatarUrl} alt={user?.displayName} />
            <AvatarFallback className="bg-primary/20 text-primary text-xs">
              {user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{user?.displayName || 'User'}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email || ''}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-[#1E1E28] text-muted-foreground hover:text-foreground" onClick={onLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
