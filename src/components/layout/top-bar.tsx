'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, Bell } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useNavigationStore, useAuthStore, useDataStore } from '@/lib/store';
import { formatDistanceToNow } from 'date-fns';

const viewLabels: Record<string, string> = {
  home: 'Home',
  ideas: 'Idea Bin',
  projects: 'Projects',
  'project-detail': 'Project',
  'track-detail': 'Track',
  'group-settings': 'Group Settings',
};

export function TopBar() {
  const { currentView, selectedProjectId, navigate } = useNavigationStore();
  const user = useAuthStore((s) => s.user);
  const currentGroupName = useAuthStore((s) => s.currentGroupName);
  const projects = useDataStore((s) => s.projects);
  const currentGroup = useDataStore((s) => s.currentGroup);
  const notifications = useDataStore((s) => s.notifications);
  const notificationCount = useDataStore((s) => s.notificationCount);
  const setNotifications = useDataStore((s) => s.setNotifications);
  const setNotificationCount = useDataStore((s) => s.setNotificationCount);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

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
  }, []);

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

  const breadcrumbs: { label: string; view?: string }[] = [
    { label: currentGroup?.name || currentGroupName || 'SoundFlow' },
  ];

  if (currentView === 'project-detail' && selectedProjectId) {
    breadcrumbs.push({ label: 'Projects', view: 'projects' });
    const project = projects.find((p) => p.id === selectedProjectId);
    breadcrumbs.push({ label: project?.title || 'Project' });
  } else if (currentView === 'track-detail' && selectedProjectId) {
    breadcrumbs.push({ label: 'Projects', view: 'projects' });
    const project = projects.find((p) => p.id === selectedProjectId);
    breadcrumbs.push({ label: project?.title || 'Project', view: 'project-detail' });
    breadcrumbs.push({ label: 'Track' });
  } else if (currentView !== 'home') {
    breadcrumbs.push({ label: viewLabels[currentView] || currentView });
  }

  return (
    <header className="glass sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-border px-4 lg:px-6 mt-14 lg:mt-0">
      <nav className="hidden sm:flex items-center gap-1.5 text-sm">
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-muted-foreground">/</span>}
            {crumb.view ? (
              <button
                onClick={() => navigate(crumb.view as 'home' | 'ideas' | 'projects' | 'project-detail' | 'track-detail' | 'group-settings' | 'onboarding', i === 2 ? selectedProjectId! : undefined)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {crumb.label}
              </button>
            ) : (
              <span className="text-foreground font-medium">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div className="flex-1" />

      <div className="relative flex items-center">
        {searchOpen ? (
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search ideas, tracks, comments..."
              className="w-48 sm:w-64 h-8 bg-input border-border text-sm"
              autoFocus
              onBlur={() => setSearchOpen(false)}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-[#1E1E28]"
              onClick={() => setSearchOpen(false)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-[#1E1E28] text-muted-foreground hover:text-foreground"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Notification Bell */}
      <div className="relative" ref={notifRef}>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 hover:bg-[#1E1E28] text-muted-foreground hover:text-foreground"
          onClick={() => setNotifOpen(!notifOpen)}
        >
          <Bell className="h-4 w-4" />
        </Button>
        {notificationCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#8A2BE2] px-1 text-[9px] font-bold text-white">
            {notificationCount > 99 ? '99+' : notificationCount}
          </span>
        )}

        {/* Notification Dropdown */}
        {notifOpen && (
          <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-[#25252D] bg-[#15151A] shadow-2xl shadow-black/60 z-50">
            <div className="flex items-center justify-between border-b border-[#25252D] p-3">
              <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
              {notificationCount > 0 && (
                <button onClick={markAllRead} className="text-[10px] text-[#8A2BE2] hover:underline">Mark all read</button>
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
                    className={`w-full text-left px-3 py-2.5 border-b border-[#25252D]/50 last:border-0 transition-colors hover:bg-[#1E1E28] ${!notif.isRead ? 'bg-[#8A2BE2]/5' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`mt-0.5 text-xs ${notif.isRead ? 'text-muted-foreground/40' : 'text-[#8A2BE2]'}`}>
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
          </div>
        )}
      </div>

      <Avatar className="h-8 w-8">
        <AvatarImage src={user?.avatarUrl} alt={user?.displayName} />
        <AvatarFallback className="bg-primary/20 text-primary text-xs">
          {user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
        </AvatarFallback>
      </Avatar>
    </header>
  );
}
