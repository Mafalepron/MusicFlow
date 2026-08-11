'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, Bell, Menu, ChevronRight, ChevronDown,
  MessageCircle, LogOut, Settings, User, Check, Copy,
  Home, Lightbulb, FolderOpen, LayoutGrid, Music,
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
      {/* Unified Header — chamfered cyberpunk HUD bar */}
      <header
        className="sticky top-0 z-30 flex h-14 items-center gap-2 px-3 lg:px-6 relative"
        style={{
          background: 'linear-gradient(180deg, #11141d 0%, #0a0c10 100%)',
          borderBottom: '1px solid rgba(31,38,51,0.6)',
          borderTop: '1px solid rgba(31,38,51,0.4)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        }}
      >
        {/* Center neon-purple underline glow */}
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-0 h-px" style={{
          width: '40%',
          background: 'linear-gradient(90deg, transparent, #7b2cbf 30%, #7b2cbf 70%, transparent)',
          boxShadow: '0 0 8px #7b2cbf, 0 0 4px #7b2cbf',
        }} />
        {/* Etched circuit traces (left + right decorative) */}
        <div className="pointer-events-none absolute bottom-0 left-0 h-px" style={{
          width: '25%',
          background: 'linear-gradient(90deg, rgba(123,44,191,0.4), transparent)',
        }} />
        <div className="pointer-events-none absolute bottom-0 right-0 h-px" style={{
          width: '25%',
          background: 'linear-gradient(90deg, transparent, rgba(123,44,191,0.4))',
        }} />

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

        {/* Search — hexagonal icon frame */}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 hover:bg-[#1E1E28] text-muted-foreground hover:text-[#00a8c6] shrink-0 transition-all"
                style={{
                  clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))',
                  border: '1px solid rgba(0,168,198,0.15)',
                }}
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

        {/* Notifications — hexagonal icon frame with purple alert badge */}
        <div className="relative" ref={notifRef}>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 hover:bg-[#1E1E28] text-muted-foreground hover:text-[#00a8c6] shrink-0 relative transition-all"
                  style={{
                    clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))',
                    border: '1px solid rgba(0,168,198,0.15)',
                  }}
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

        {/* Chat toggle — hexagonal icon frame */}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleChat}
                disabled={!activeChatProjectId}
                className={cn(
                  'relative h-9 w-9 flex items-center justify-center transition-all duration-200 shrink-0',
                  chatOpen
                    ? 'bg-cyan-500/15 text-cyan-400'
                    : activeChatProjectId
                      ? 'text-muted-foreground hover:text-cyan-400 hover:bg-cyan-500/10'
                      : 'text-muted-foreground/40 cursor-not-allowed',
                )}
                style={{
                  clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))',
                  border: chatOpen
                    ? '1px solid rgba(0,168,198,0.5)'
                    : '1px solid rgba(0,168,198,0.15)',
                }}
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

        {/* Profile dropdown — hexagonal chamfered avatar frame with cyan gradient border */}
        <Popover open={profileOpen} onOpenChange={setProfileOpen}>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-2 pl-1 pr-2 py-1 hover:bg-[#1E1E28] transition-colors shrink-0" style={{
                    clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))',
                  }}>
                    <div className="relative h-7 w-7" style={{
                      clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                      padding: '1.5px',
                      background: 'linear-gradient(135deg, #00a8c6, #7b2cbf)',
                      boxShadow: '0 0 8px rgba(0,168,198,0.25)',
                    }}>
                      <Avatar className="h-full w-full" style={{
                        clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                        borderRadius: 0,
                      }}>
                        <AvatarImage src={user?.avatarUrl} alt={user?.displayName} />
                        <AvatarFallback className="bg-[#0a0c10] text-[#00a8c6] text-xs">
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
