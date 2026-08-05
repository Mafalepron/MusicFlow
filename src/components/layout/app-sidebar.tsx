'use client';

import { useState } from 'react';
import { Music, Home, Lightbulb, FolderOpen, Settings, LogOut, Copy, Check, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useNavigationStore, useAuthStore, useDataStore, type ViewName } from '@/lib/store';

const navItems: { icon: typeof Home; label: string; view: ViewName }[] = [
  { icon: Home, label: 'Home', view: 'home' },
  { icon: Lightbulb, label: 'Ideas', view: 'ideas' },
  { icon: FolderOpen, label: 'Projects', view: 'projects' },
  { icon: LayoutGrid, label: 'Kanban', view: 'kanban' },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { currentView, navigate } = useNavigationStore();
  const { user, logout, currentGroupName: persistedGroupName, currentGroupInviteCode: persistedInviteCode } = useAuthStore();
  const currentGroup = useDataStore((s) => s.currentGroup);
  const notificationCount = useDataStore((s) => s.notificationCount);
  const [copied, setCopied] = useState(false);

  const groupName = currentGroup?.name || persistedGroupName || 'SoundFlow';
  const inviteCode = currentGroup?.inviteCode || persistedInviteCode || '';

  const handleNavigate = (view: ViewName) => {
    navigate(view);
    onNavigate?.();
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

      {/* Group Selector */}
      {(currentGroup || persistedGroupName) && (
        <div className="px-3 py-3">
          <div className="rounded-lg bg-[#1E1E28] p-3">
            <p className="text-sm font-medium text-foreground truncate">
              {groupName}
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <code className="flex-1 rounded bg-background px-2 py-0.5 text-xs text-[#00E5FF] font-mono">
                {inviteCode}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 hover:bg-[#2A2A36]"
                onClick={handleCopyCode}
              >
                {copied ? (
                  <Check className="h-3 w-3 text-[#10B981]" />
                ) : (
                  <Copy className="h-3 w-3 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-2">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = currentView === item.view ||
              (item.view === 'projects' && (currentView === 'project-detail' || currentView === 'track-detail'));
            return (
              <TooltipProvider key={item.view} delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleNavigate(item.view)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
                        ${isActive
                          ? 'bg-primary/10 text-primary border-l-2 border-primary'
                          : 'text-muted-foreground hover:bg-[#1E1E28] hover:text-foreground border-l-2 border-transparent'
                        }`
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                      {item.view === 'projects' && notificationCount > 0 && (
                        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[#8A2BE2] px-1.5 text-[9px] font-bold text-white">
                          {notificationCount > 99 ? '99+' : notificationCount}
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-card border-border text-foreground">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}

          <button
            onClick={() => handleNavigate('group-settings')}
            className={currentView === 'group-settings'
              ? 'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors bg-primary/10 text-primary border-l-2 border-primary'
              : 'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-muted-foreground hover:bg-[#1E1E28] hover:text-foreground border-l-2 border-transparent'
            }
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
            <p className="text-sm font-medium text-foreground truncate">
              {user?.displayName || 'User'}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {user?.email || ''}
            </p>
          </div>
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-[#1E1E28] text-muted-foreground hover:text-foreground"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-card border-border text-foreground">Logout</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}

export function AppSidebar() {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0 lg:z-30 border-r border-border bg-sidebar">
        <SidebarContent />
      </aside>
    </>
  );
}
