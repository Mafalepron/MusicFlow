'use client';

import { useState } from 'react';
import {
  Home,
  Lightbulb,
  FolderOpen,
  Settings,
  LogOut,
  Copy,
  Check,
  LayoutGrid,
  Hexagon,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useNavigationStore, useAuthStore, useDataStore, type ViewName } from '@/lib/store';
import { hexToRgba } from '@/lib/utils';

/* ─── cyberpunk palette ─── */
const YELLOW = '#c7a008';
const CYAN = '#00a8c6';
const RED = '#EF4444';
const GREEN = '#10B981';

const CARD_CLIP =
  'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))';
const BTN_CLIP =
  'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))';
const NAV_CLIP =
  'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))';

const navItems: { icon: typeof Home; label: string; view: ViewName }[] = [
  { icon: Home, label: 'Home', view: 'home' },
  { icon: Lightbulb, label: 'Ideas', view: 'ideas' },
  { icon: FolderOpen, label: 'Projects', view: 'projects' },
  // Kanban tab merged into Projects — entry point is now via project cards.
];

function NavItem({
  item,
  isActive,
  hasBadge,
  badgeCount,
  onClick,
}: {
  item: { icon: typeof Home; label: string; view: ViewName };
  isActive: boolean;
  hasBadge?: boolean;
  badgeCount?: number;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const color = isActive ? YELLOW : CYAN;

  return (
    <TooltipProvider key={item.view} delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="relative flex w-full items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all duration-200"
            style={{
              clipPath: NAV_CLIP,
              color: isActive ? YELLOW : hovered ? '#e2e8f0' : '#94a3b8',
              background: isActive
                ? hexToRgba(YELLOW, 0.08)
                : hovered
                ? hexToRgba(CYAN, 0.06)
                : 'transparent',
              boxShadow: isActive
                ? `inset 2px 0 0 ${YELLOW}, inset 0 0 12px ${hexToRgba(YELLOW, 0.12)}`
                : hovered
                ? `inset 2px 0 0 ${hexToRgba(CYAN, 0.5)}`
                : 'inset 2px 0 0 transparent',
            }}
          >
            <item.icon
              className="h-4 w-4 shrink-0"
              style={{
                color,
                filter: isActive
                  ? `drop-shadow(0 0 4px ${hexToRgba(YELLOW, 0.6)})`
                  : hovered
                  ? `drop-shadow(0 0 4px ${hexToRgba(CYAN, 0.4)})`
                  : 'none',
              }}
            />
            <span className="uppercase tracking-[0.12em] text-xs">{item.label}</span>
            {hasBadge && badgeCount !== undefined && badgeCount > 0 && (
              <span
                className="ml-auto flex h-5 min-w-5 items-center justify-center px-1.5 text-[9px] font-bold"
                style={{
                  clipPath: BTN_CLIP,
                  background: hexToRgba(YELLOW, 0.18),
                  color: YELLOW,
                  boxShadow: `inset 0 0 0 1px ${hexToRgba(YELLOW, 0.5)}`,
                }}
              >
                {badgeCount > 99 ? '99+' : badgeCount}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          className="border text-xs"
          style={{
            background: 'rgba(8,12,22,0.95)',
            borderColor: hexToRgba(CYAN, 0.3),
            color: '#e2e8f0',
          }}
        >
          {item.label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { currentView, navigate } = useNavigationStore();
  const {
    user,
    logout,
    currentGroupName: persistedGroupName,
    currentGroupInviteCode: persistedInviteCode,
  } = useAuthStore();
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
    <div className="relative flex h-full flex-col bg-[#05080f] text-slate-100">
      {/* subtle grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage: `linear-gradient(${hexToRgba(CYAN, 0.035)} 1px, transparent 1px), linear-gradient(90deg, ${hexToRgba(CYAN, 0.035)} 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      {/* ─── Logo ─── */}
      <div className="relative px-4 py-5">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center"
            style={{
              clipPath: BTN_CLIP,
              background: hexToRgba(YELLOW, 0.12),
              boxShadow: `inset 0 0 0 1px ${hexToRgba(YELLOW, 0.5)}, 0 0 12px ${hexToRgba(YELLOW, 0.2)}`,
            }}
          >
            <Hexagon
              className="h-4 w-4"
              style={{
                color: YELLOW,
                filter: `drop-shadow(0 0 4px ${hexToRgba(YELLOW, 0.7)})`,
              }}
            />
          </div>
          <span
            className="text-base font-bold uppercase tracking-[0.18em]"
            style={{
              color: YELLOW,
              textShadow: `0 0 8px ${hexToRgba(YELLOW, 0.5)}, 0 0 20px ${hexToRgba(YELLOW, 0.2)}`,
            }}
          >
            SoundFlow
          </span>
        </div>
      </div>

      {/* divider with cyan glow */}
      <div
        className="mx-4 mb-2 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${hexToRgba(CYAN, 0.4)}, transparent)`,
        }}
      />

      {/* ─── Group info card ─── */}
      {(currentGroup || persistedGroupName) && (
        <div className="relative px-3 py-2">
          <div
            className="p-3"
            style={{
              clipPath: CARD_CLIP,
              background: 'rgba(8,12,22,0.9)',
              boxShadow: `inset 0 0 0 1px ${hexToRgba(CYAN, 0.3)}, 0 0 16px ${hexToRgba(CYAN, 0.05)}`,
            }}
          >
            <p
              className="mb-2 truncate text-xs font-bold uppercase tracking-[0.14em] text-slate-100"
              title={groupName}
            >
              {groupName}
            </p>
            <div className="flex items-center gap-1.5">
              <code
                className="flex-1 px-2 py-1 font-mono text-[11px] tracking-wider"
                style={{
                  clipPath: BTN_CLIP,
                  background: hexToRgba(CYAN, 0.08),
                  color: CYAN,
                  boxShadow: `inset 0 0 0 1px ${hexToRgba(CYAN, 0.3)}`,
                  textShadow: `0 0 6px ${hexToRgba(CYAN, 0.5)}`,
                }}
              >
                {inviteCode || '—'}
              </code>
              <button
                onClick={handleCopyCode}
                className="flex h-6 w-6 items-center justify-center transition-all duration-200 hover:opacity-100"
                style={{
                  clipPath: BTN_CLIP,
                  background: hexToRgba(CYAN, 0.06),
                  opacity: copied ? 1 : 0.7,
                  boxShadow: `inset 0 0 0 1px ${hexToRgba(CYAN, 0.25)}`,
                }}
                aria-label="Copy invite code"
              >
                {copied ? (
                  <Check className="h-3 w-3" style={{ color: GREEN }} />
                ) : (
                  <Copy className="h-3 w-3" style={{ color: CYAN }} />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Navigation ─── */}
      <ScrollArea className="relative flex-1 px-3 py-2">
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const isActive =
              currentView === item.view ||
              (item.view === 'projects' &&
                (currentView === 'project-detail' || currentView === 'track-detail'));
            return (
              <NavItem
                key={item.view}
                item={item}
                isActive={isActive}
                hasBadge={item.view === 'projects'}
                badgeCount={notificationCount}
                onClick={() => handleNavigate(item.view)}
              />
            );
          })}

          <NavItem
            item={{ icon: Settings, label: 'Settings', view: 'group-settings' as ViewName }}
            isActive={currentView === 'group-settings'}
            onClick={() => handleNavigate('group-settings')}
          />
        </nav>
      </ScrollArea>

      {/* ─── divider ─── */}
      <div
        className="mx-4 my-1 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${hexToRgba(CYAN, 0.3)}, transparent)`,
        }}
      />

      {/* ─── User section ─── */}
      <div className="relative p-3">
        <div className="flex items-center gap-3">
          {/* avatar with angular clip-path frame */}
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center"
            style={{
              clipPath: BTN_CLIP,
              background: hexToRgba(CYAN, 0.1),
              boxShadow: `inset 0 0 0 1px ${hexToRgba(CYAN, 0.4)}`,
            }}
          >
            <Avatar className="h-7 w-7">
              <AvatarImage src={user?.avatarUrl} alt={user?.displayName} />
              <AvatarFallback
                className="bg-transparent text-xs font-bold"
                style={{ color: CYAN }}
              >
                {user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold uppercase tracking-wider text-slate-100">
              {user?.displayName || 'User'}
            </p>
            <p className="truncate text-[10px] uppercase tracking-wider text-slate-500">
              {user?.email || ''}
            </p>
          </div>
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleLogout}
                  className="flex h-8 w-8 items-center justify-center transition-all duration-200"
                  style={{
                    clipPath: BTN_CLIP,
                    background: hexToRgba(RED, 0.06),
                    boxShadow: `inset 0 0 0 1px ${hexToRgba(RED, 0.25)}`,
                    color: '#94a3b8',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = hexToRgba(RED, 0.15);
                    e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${hexToRgba(RED, 0.6)}, 0 0 12px ${hexToRgba(RED, 0.2)}`;
                    e.currentTarget.style.color = RED;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = hexToRgba(RED, 0.06);
                    e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${hexToRgba(RED, 0.25)}`;
                    e.currentTarget.style.color = '#94a3b8';
                  }}
                  aria-label="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="border text-xs"
                style={{
                  background: 'rgba(8,12,22,0.95)',
                  borderColor: hexToRgba(RED, 0.4),
                  color: '#e2e8f0',
                }}
              >
                Logout
              </TooltipContent>
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
      <aside className="hidden lg:fixed lg:inset-y-0 lg:z-30 lg:flex lg:w-60 lg:flex-col border-r border-[#1a2030] bg-[#05080f]">
        <SidebarContent />
      </aside>
    </>
  );
}
