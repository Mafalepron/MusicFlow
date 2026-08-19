'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Hexagon,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  X,
  Copy,
  Check,
  Pencil,
  Music2,
  FolderOpen,
  Users,
  Disc3,
  Lightbulb,
  MessageCircle,
  Calendar,
  ChevronDown,
  Zap,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useNavigationStore, useAuthStore, useDataStore, type Group, type Project } from '@/lib/store';
import { useSidebarStore } from '@/store/sidebar-store';
import { useChatContextStore } from '@/store/chat-context-store';
import ProjectChat from '@/components/chat/project-chat';
import { hexToRgba } from '@/lib/utils';
import { cn } from '@/lib/utils';

/* ─── cyberpunk palette (legacy — still used by floating sidebar toggles) ─── */
const RED = '#EF4444';
const GREEN = '#10B981';

/* ─── neon synthwave palette (matches top quick-access panel) ─── */
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

const BTN_CLIP =
  'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))';

/* ────────────────────────────────────────────────────────────────────────── */
/*  Group switcher — small < name > control. Only renders when the user      */
/*  has more than one group.                                                 */
/* ────────────────────────────────────────────────────────────────────────── */
function GroupSwitcher({
  groups,
  currentIndex,
  onSelect,
}: {
  groups: Group[];
  currentIndex: number;
  onSelect: (index: number) => void;
}) {
  if (groups.length <= 1) return null;
  const atStart = currentIndex <= 0;
  const atEnd = currentIndex >= groups.length - 1;
  const total = groups.length;

  return (
    <div className="flex items-center justify-center gap-2 mt-2">
      <button
        onClick={() => !atStart && onSelect(currentIndex - 1)}
        disabled={atStart}
        aria-label="Previous group"
        className={cn(
          'flex h-6 w-6 items-center justify-center transition-all',
          atStart ? 'opacity-30 cursor-not-allowed' : 'hover:opacity-100 opacity-70'
        )}
        style={{
          borderRadius: '4px',
          background: `rgba(${NEON_CYAN_RGB},0.05)`,
          border: `1px solid rgba(${NEON_CYAN_RGB},0.3)`,
          cursor: atStart ? 'not-allowed' : 'pointer',
        }}
      >
        <ChevronLeft className="h-3.5 w-3.5" style={{ color: NEON_CYAN }} />
      </button>
      <span
        className="text-[10px] uppercase tracking-[0.18em] font-bold"
        style={{
          color: NEON_CYAN,
          fontFamily: FONT_MONO,
          textShadow: `0 0 6px rgba(${NEON_CYAN_RGB},0.4)`,
        }}
      >
        {currentIndex + 1} / {total}
      </span>
      <button
        onClick={() => !atEnd && onSelect(currentIndex + 1)}
        disabled={atEnd}
        aria-label="Next group"
        className={cn(
          'flex h-6 w-6 items-center justify-center transition-all',
          atEnd ? 'opacity-30 cursor-not-allowed' : 'hover:opacity-100 opacity-70'
        )}
        style={{
          borderRadius: '4px',
          background: `rgba(${NEON_CYAN_RGB},0.05)`,
          border: `1px solid rgba(${NEON_CYAN_RGB},0.3)`,
          cursor: atEnd ? 'not-allowed' : 'pointer',
        }}
      >
        <ChevronRight className="h-3.5 w-3.5" style={{ color: NEON_CYAN }} />
      </button>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Editable group description — click to edit, PATCH /api/groups/[id]       */
/*  on blur or Cmd/Ctrl+Enter.                                               */
/* ────────────────────────────────────────────────────────────────────────── */
function EditableDescription({
  group,
  onSaved,
}: {
  group: Group | null;
  onSaved?: (next: Group) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(group?.description || '');
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep draft in sync with the latest group description when not editing.
  useEffect(() => {
    if (!editing) setDraft(group?.description || '');
  }, [group?.description, editing, group?.id]);

  // Focus + select-all when entering edit mode.
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editing]);

  const save = useCallback(async () => {
    if (!group) return;
    const trimmed = draft.trim();
    if (trimmed === (group.description || '').trim()) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/groups/${group.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: trimmed }),
      });
      if (res.ok) {
        const updated = await res.json();
        onSaved?.(updated);
      }
    } catch {
      /* swallow */
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }, [draft, group, onSaved]);

  if (editing) {
    return (
      <div className="mt-2">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              save();
            }
            if (e.key === 'Escape') {
              setDraft(group?.description || '');
              setEditing(false);
            }
          }}
          rows={3}
          maxLength={500}
          placeholder="Введите описание группы…"
          className="w-full resize-none px-2 py-1.5 text-[11px] leading-relaxed focus:outline-none"
          style={{
            borderRadius: '6px',
            background: 'rgba(10,20,35,0.6)',
            color: '#ffffff',
            fontFamily: FONT_MONO,
            border: `1px solid rgba(${NEON_CYAN_RGB},0.5)`,
          }}
        />
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-wider" style={{ color: '#8892a0', fontFamily: FONT_MONO }}>
            {saving ? 'Сохранение…' : '⌘/Ctrl+Enter — сохранить · Esc — отмена'}
          </span>
          <span className="text-[9px] tabular-nums" style={{ color: '#8892a0', fontFamily: FONT_MONO }}>{draft.length}/500</span>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="group mt-2 block w-full text-left"
      title="Нажмите, чтобы редактировать описание"
    >
      <div
        className="relative px-2.5 py-1.5 text-[11px] leading-relaxed transition-all"
        style={{
          borderRadius: '6px',
          background: 'rgba(10,20,35,0.6)',
          border: `1px solid rgba(${NEON_CYAN_RGB},0.2)`,
          color: '#cfd6e0',
          fontFamily: FONT_MONO,
        }}
      >
        {group?.description?.trim() ? (
          <p className="whitespace-pre-wrap break-words pr-5">{group.description}</p>
        ) : (
          <p className="italic pr-5" style={{ color: '#8892a0' }}>Нет описания. Нажмите, чтобы добавить…</p>
        )}
        <Pencil
          className="absolute right-1.5 top-1.5 h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100"
          style={{ color: NEON_CYAN }}
        />
      </div>
    </button>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Artist profile card — group avatar, name, genre, editable description,   */
/*  performance stats, group switcher, linked projects list.                  */
/* ────────────────────────────────────────────────────────────────────────── */
function ArtistProfileCard() {
  const { user, currentGroupId, setCurrentGroupId, setCurrentGroupName, setCurrentGroupInviteCode } = useAuthStore();
  const currentGroup = useDataStore((s) => s.currentGroup);
  const setCurrentGroup = useDataStore((s) => s.setCurrentGroup);
  const projects = useDataStore((s) => s.projects);
  const tracks = useDataStore((s) => s.tracks);
  const ideas = useDataStore((s) => s.ideas);
  const navigate = useNavigationStore((s) => s.navigate);
  // Profile card collapse/expand — when collapsed, the chat fills the freed space.
  const profileCollapsed = useSidebarStore((s) => s.profileCollapsed);
  const toggleProfile = useSidebarStore((s) => s.toggleProfile);

  // Local copy of the user's group memberships — fetched on mount via
  // /api/groups?userId=… so the < > switcher can work even though the
  // global `groups` array isn't populated elsewhere.
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    fetch(`/api/groups?userId=${user.id}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Group[]) => {
        if (!cancelled) setUserGroups(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const currentIndex = useMemo(() => {
    if (!currentGroupId) return 0;
    const idx = userGroups.findIndex((g) => g.id === currentGroupId);
    return idx === -1 ? 0 : idx;
  }, [userGroups, currentGroupId]);

  // Group switcher handler — set currentGroupId + pull fresh group info.
  const handleSwitchGroup = useCallback(
    (nextIndex: number) => {
      const next = userGroups[nextIndex];
      if (!next) return;
      setCurrentGroupId(next.id);
      setCurrentGroupName(next.name);
      setCurrentGroupInviteCode(next.inviteCode);
      // Refetch the full group record so currentGroup has all fields.
      fetch(`/api/groups/${next.id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((g) => {
          if (g) {
            setCurrentGroup(g);
            setCurrentGroupName(g.name);
            setCurrentGroupInviteCode(g.inviteCode);
          }
        })
        .catch(() => {});
    },
    [userGroups, setCurrentGroupId, setCurrentGroupName, setCurrentGroupInviteCode, setCurrentGroup]
  );

  // Projects linked to this group — filter by groupId.
  const groupProjects = useMemo<Project[]>(() => {
    if (!currentGroup) return [];
    return projects.filter((p) => p.groupId === currentGroup.id);
  }, [projects, currentGroup]);

  // Tracks count for this group.
  const groupTrackCount = useMemo(() => {
    if (!currentGroup) return 0;
    const ids = new Set(groupProjects.map((p) => p.id));
    return tracks.filter((t) => ids.has(t.projectId)).length;
  }, [tracks, groupProjects, currentGroup]);

  // Ideas count for this group.
  const groupIdeaCount = useMemo(() => {
    if (!currentGroup) return 0;
    return ideas.filter((i) => i.groupId === currentGroup.id).length;
  }, [ideas, currentGroup]);

  // Member count — fetched alongside group info.
  const [memberCount, setMemberCount] = useState(0);
  useEffect(() => {
    if (!currentGroup?.id) return;
    fetch(`/api/groups/${currentGroup.id}/members`)
      .then((r) => (r.ok ? r.json() : []))
      .then((m: unknown) => setMemberCount(Array.isArray(m) ? m.length : 0))
      .catch(() => {});
  }, [currentGroup?.id]);

  // Created date (formatted).
  const createdLabel = useMemo(() => {
    if (!currentGroup) return '—';
    const raw = (userGroups.find((g) => g.id === currentGroup.id) as unknown as { createdAt?: string } | undefined)?.createdAt;
    if (!raw) return '—';
    try {
      return new Date(raw).toLocaleDateString('ru-RU', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return '—';
    }
  }, [currentGroup, userGroups]);

  if (!currentGroup) {
    return (
      <div className="px-3 py-3">
        <div
          className="p-3 text-center text-[11px]"
          style={{
            borderRadius: '12px',
            background: 'rgba(10,14,23,0.85)',
            backdropFilter: 'blur(16px)',
            border: `1px solid rgba(${NEON_CYAN_RGB},0.3)`,
            color: '#8892a0',
            fontFamily: FONT_MONO,
          }}
        >
          Группа не выбрана
        </div>
      </div>
    );
  }

  // Collapsed view — compact bar with avatar + name + expand button.
  if (profileCollapsed) {
    return (
      <div className="px-3 pt-3 pb-2">
        <button
          onClick={toggleProfile}
          className="group flex w-full items-center gap-2.5 px-2.5 py-2.5 transition-all duration-200"
          style={{
            borderRadius: '8px',
            background: 'rgba(10,20,35,0.6)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(0,240,255,0.2)',
            cursor: 'pointer',
          }}
          title="Развернуть карточку группы"
          aria-label="Развернуть карточку группы"
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255,0,170,0.5)';
            e.currentTarget.style.boxShadow = '0 0 16px rgba(255,0,170,0.15), 0 0 4px rgba(0,240,255,0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(0,240,255,0.2)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden"
            style={{
              borderRadius: '6px',
              background: 'rgba(255,0,170,0.08)',
              border: '1px solid rgba(255,0,170,0.4)',
            }}
          >
            <Avatar className="h-7 w-7" style={{ borderRadius: 0 }}>
              <AvatarImage src={currentGroup.avatarUrl} alt={currentGroup.name} />
              <AvatarFallback
                className="bg-transparent text-xs font-bold"
                style={{
                  color: NEON_MAGENTA,
                  fontFamily: FONT_DISPLAY,
                  textShadow: '0 0 6px rgba(255,0,170,0.6)',
                }}
              >
                {currentGroup.name?.charAt(0)?.toUpperCase() || 'G'}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p
              className="truncate text-xs font-semibold uppercase tracking-wider"
              style={{
                color: '#ffffff',
                fontFamily: FONT_DISPLAY,
              }}
            >
              {currentGroup.name}
            </p>
            {currentGroup.genre && (
              <p
                className="truncate text-[9px] uppercase tracking-[1px]"
                style={{
                  color: NEON_CYAN,
                  fontFamily: FONT_MONO,
                  textShadow: '0 0 4px rgba(0,240,255,0.4)',
                }}
              >
                {currentGroup.genre}
              </p>
            )}
          </div>
          <ChevronDown
            className="h-3.5 w-3.5 shrink-0 rotate-180 transition-transform"
            style={{ color: NEON_CYAN }}
          />
        </button>
      </div>
    );
  }

  // Stats — magenta icons, white numbers, cyan labels (matches quick-access panel).
  const stats: { icon: typeof Users; label: string; value: number }[] = [
    { icon: Users, label: 'Участн.', value: memberCount },
    { icon: FolderOpen, label: 'Проекты', value: groupProjects.length },
    { icon: Music2, label: 'Треки', value: groupTrackCount },
    { icon: Lightbulb, label: 'Идеи', value: groupIdeaCount },
  ];

  // Expanded view — full neon glassmorphism card matching the quick-access panel.
  return (
    <div className="px-3 pt-3 pb-2 h-full min-h-0 flex flex-col">
      <div
        className="relative flex flex-col h-full overflow-hidden"
        style={{
          borderRadius: '12px',
          background: 'rgba(10,14,23,0.85)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(0,240,255,0.3)',
          boxShadow:
            '0 0 24px rgba(0,240,255,0.15), 0 0 8px rgba(255,0,170,0.1), 0 12px 40px rgba(0,0,0,0.7)',
        }}
      >
        {/* Top accent strip — cyan glow */}
        <div
          className="h-[2px] w-full shrink-0"
          style={{
            background: 'linear-gradient(90deg, transparent, #00f0ff 30%, #00f0ff 70%, transparent)',
            boxShadow: '0 0 6px rgba(0,240,255,0.6)',
          }}
        />

        {/* Header bar — title + collapse button */}
        <div
          className="flex items-center justify-between px-3.5 pt-3 pb-3 shrink-0"
          style={{ borderBottom: '1px solid rgba(0,240,255,0.15)' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="flex h-6 w-6 items-center justify-center"
              style={{
                borderRadius: '6px',
                background: 'rgba(255,0,170,0.08)',
                border: '1px solid rgba(255,0,170,0.3)',
              }}
            >
              <Zap
                className="h-3 w-3"
                style={{ color: NEON_MAGENTA, filter: 'drop-shadow(0 0 3px rgba(255,0,170,0.6))' }}
              />
            </div>
            <span
              className="text-[10px] font-semibold uppercase tracking-[2px] truncate"
              style={{
                color: NEON_CYAN,
                fontFamily: FONT_MONO,
                textShadow: '0 0 6px rgba(0,240,255,0.4)',
              }}
            >
              Профиль группы
            </span>
          </div>
          <button
            onClick={toggleProfile}
            className="flex h-6 w-6 items-center justify-center transition-all duration-200"
            style={{
              borderRadius: '6px',
              background: 'rgba(0,240,255,0.05)',
              border: '1px solid rgba(0,240,255,0.3)',
              cursor: 'pointer',
            }}
            title="Свернуть карточку"
            aria-label="Свернуть карточку"
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
            <ChevronDown
              className="h-3.5 w-3.5 transition-transform"
              style={{ color: NEON_CYAN }}
            />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-3.5 pb-3 pt-3">
          {/* Avatar + switcher row */}
          <div className="flex flex-col items-center pt-1">
            <div
              className="relative flex h-16 w-16 items-center justify-center overflow-hidden"
              style={{
                borderRadius: '8px',
                background: 'rgba(255,0,170,0.08)',
                border: '1.5px solid rgba(255,0,170,0.5)',
                boxShadow: '0 0 18px rgba(255,0,170,0.15)',
              }}
            >
              <Avatar className="h-14 w-14" style={{ borderRadius: 0 }}>
                <AvatarImage src={currentGroup.avatarUrl} alt={currentGroup.name} />
                <AvatarFallback
                  className="bg-transparent text-lg font-bold"
                  style={{
                    color: NEON_MAGENTA,
                    fontFamily: FONT_DISPLAY,
                    textShadow: '0 0 8px rgba(255,0,170,0.6)',
                  }}
                >
                  {currentGroup.name?.charAt(0)?.toUpperCase() || 'G'}
                </AvatarFallback>
              </Avatar>
            </div>

            <GroupSwitcher
              groups={userGroups}
              currentIndex={currentIndex}
              onSelect={handleSwitchGroup}
            />
          </div>

          {/* Group name + genre */}
          <div className="mt-2 text-center">
            <p
              className="truncate text-base font-bold uppercase tracking-[0.14em]"
              style={{
                color: '#ffffff',
                fontFamily: FONT_DISPLAY,
                textShadow: '0 0 10px rgba(255,0,170,0.4)',
              }}
              title={currentGroup.name}
            >
              {currentGroup.name}
            </p>
            {currentGroup.genre && (
              <p
                className="mt-1 text-[10px] uppercase tracking-[1.5px] font-medium"
                style={{
                  color: NEON_CYAN,
                  fontFamily: FONT_MONO,
                  textShadow: '0 0 6px rgba(0,240,255,0.4)',
                }}
              >
                <Disc3
                  className="inline h-2.5 w-2.5 mr-1 -mt-0.5"
                  style={{ color: NEON_CYAN }}
                />
                {currentGroup.genre}
              </p>
            )}
          </div>

          {/* Invite code */}
          {currentGroup.inviteCode && (
            <InviteCodeRow code={currentGroup.inviteCode} />
          )}

          {/* Editable description */}
          <EditableDescription
            group={currentGroup}
            onSaved={(g) => setCurrentGroup(g)}
          />

          {/* Performance info section */}
          <div className="mt-3">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="flex h-3.5 w-3.5 items-center justify-center"
                style={{
                  borderRadius: '4px',
                  background: 'rgba(255,0,170,0.08)',
                  border: '1px solid rgba(255,0,170,0.3)',
                }}
              >
                <Calendar
                  className="h-2 w-2"
                  style={{ color: NEON_MAGENTA }}
                />
              </div>
              <span
                className="text-[9px] font-bold uppercase tracking-[1px]"
                style={{
                  color: NEON_MAGENTA,
                  fontFamily: FONT_MONO,
                  textShadow: '0 0 4px rgba(255,0,170,0.4)',
                }}
              >
                Показатели
              </span>
              <div
                className="flex-1 h-px"
                style={{
                  background:
                    'linear-gradient(90deg, rgba(255,0,170,0.3), transparent)',
                }}
              />
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="group/stat flex flex-col items-center py-1.5 transition-all duration-200"
                  style={{
                    clipPath: YELLOW_BTN_CLIP,
                    background: 'linear-gradient(135deg, rgba(252,238,10,0.95), rgba(241,241,0,0.9) 50%, rgba(252,238,10,0.95))',
                    border: '1px solid rgba(252,238,10,0.9)',
                    boxShadow: '0 0 10px rgba(252,238,10,0.3), inset 0 1px 0 rgba(255,255,255,0.4)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 0 14px rgba(252,238,10,0.5), 0 0 20px rgba(252,238,10,0.15), inset 0 1px 0 rgba(255,255,255,0.5)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 0 10px rgba(252,238,10,0.3), inset 0 1px 0 rgba(255,255,255,0.4)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <s.icon
                    className="h-3 w-3 mb-0.5"
                    style={{
                      color: '#000',
                      filter: 'drop-shadow(0 1px 0 rgba(255,255,255,0.3))',
                    }}
                  />
                  <span
                    className="text-sm font-bold tabular-nums leading-none"
                    style={{
                      color: '#000',
                      fontFamily: FONT_DISPLAY,
                      textShadow: '0 1px 0 rgba(255,255,255,0.3)',
                    }}
                  >
                    {s.value}
                  </span>
                  <span
                    className="mt-0.5 text-[8px] uppercase tracking-wider font-bold"
                    style={{
                      color: '#000',
                      fontFamily: FONT_MONO,
                      opacity: 0.7,
                    }}
                  >
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
            <div
              className="mt-2 flex items-center gap-1.5 px-2 py-1.5"
              style={{
                clipPath: YELLOW_BTN_CLIP,
                background: 'linear-gradient(135deg, rgba(252,238,10,0.95), rgba(241,241,0,0.9) 50%, rgba(252,238,10,0.95))',
                border: '1px solid rgba(252,238,10,0.9)',
                boxShadow: '0 0 10px rgba(252,238,10,0.3), inset 0 1px 0 rgba(255,255,255,0.4)',
              }}
            >
              <Calendar className="h-2.5 w-2.5" style={{ color: '#000' }} />
              <span
                className="text-[9px] uppercase tracking-wider font-bold"
                style={{ color: '#000', fontFamily: FONT_MONO, opacity: 0.7 }}
              >
                Создан:
              </span>
              <span
                className="ml-auto text-[9px] tabular-nums font-bold"
                style={{ color: '#000', fontFamily: FONT_MONO, textShadow: '0 1px 0 rgba(255,255,255,0.3)' }}
              >
                {createdLabel}
              </span>
            </div>
          </div>

          {/* Linked projects section */}
          <div className="mt-3">
            <div className="flex items-center gap-2 mb-1.5">
              <FolderOpen
                className="h-3 w-3"
                style={{ color: NEON_MAGENTA }}
              />
              <span
                className="text-[9px] font-bold uppercase tracking-[1px]"
                style={{
                  color: NEON_MAGENTA,
                  fontFamily: FONT_MONO,
                  textShadow: '0 0 4px rgba(255,0,170,0.4)',
                }}
              >
                Проекты группы
              </span>
              <span
                className="ml-auto text-[9px] tabular-nums"
                style={{ color: '#8892a0', fontFamily: FONT_MONO }}
              >
                {groupProjects.length}
              </span>
            </div>
            {groupProjects.length === 0 ? (
              <p
                className="text-[10px] italic px-1"
                style={{ color: '#8892a0', fontFamily: FONT_MONO }}
              >
                Нет проектов
              </p>
            ) : (
              <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-1">
                {groupProjects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => navigate('project-detail', p.id)}
                    className="group/proj flex w-full items-center gap-2 px-2 py-1.5 text-left transition-all duration-200"
                    style={{
                      borderRadius: '6px',
                      background: 'rgba(10,20,35,0.6)',
                      border: '1px solid rgba(0,240,255,0.2)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255,0,170,0.5)';
                      e.currentTarget.style.boxShadow =
                        '0 0 12px rgba(255,0,170,0.15), 0 0 4px rgba(0,240,255,0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(0,240,255,0.2)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    title={`Открыть: ${p.title}`}
                  >
                    <span
                      className="flex h-4 w-4 shrink-0 items-center justify-center"
                      style={{
                        borderRadius: '4px',
                        background: 'rgba(255,0,170,0.08)',
                        border: '1px solid rgba(255,0,170,0.3)',
                      }}
                    >
                      <Music2
                        className="h-2 w-2"
                        style={{ color: NEON_MAGENTA }}
                      />
                    </span>
                    <span
                      className="flex-1 truncate text-[10px]"
                      style={{
                        color: '#ffffff',
                        fontFamily: FONT_MONO,
                      }}
                    >
                      {p.title}
                    </span>
                    <span
                      className="text-[8px] uppercase tracking-wider"
                      style={{ color: NEON_CYAN }}
                    >
                      {p.type}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Invite code row — small box + copy button                                 */
/* ────────────────────────────────────────────────────────────────────────── */
function InviteCodeRow({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="mt-2 flex items-center gap-1.5">
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
        {code}
      </code>
      <button
        onClick={handleCopy}
        aria-label="Copy invite code"
        className="flex h-6 w-6 items-center justify-center transition-all duration-200"
        style={{
          borderRadius: '6px',
          background: 'rgba(0,240,255,0.05)',
          border: '1px solid rgba(0,240,255,0.3)',
          cursor: 'pointer',
        }}
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
          <Check className="h-3 w-3" style={{ color: GREEN }} />
        ) : (
          <Copy className="h-3 w-3" style={{ color: NEON_CYAN }} />
        )}
      </button>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Project chat section — lives at the bottom of the sidebar.                */
/*  - Project selector dropdown at top                                          */
/*  - "Выберите проект для чата" placeholder when no project selected          */
/*  - Embedded <ProjectChat embedded/> fills the rest of the section —        */
/*    the chat is ALWAYS VISIBLE in the sidebar (no floating popup).          */
/* ────────────────────────────────────────────────────────────────────────── */
function SidebarChatSection() {
  const projects = useDataStore((s) => s.projects);
  const currentGroup = useDataStore((s) => s.currentGroup);
  const { activeChatProjectId, activeChatProjectName, setActiveChatProject } = useChatContextStore();
  const [pickerOpen, setPickerOpen] = useState(false);

  // Projects linked to the current group.
  const groupProjects = useMemo<Project[]>(() => {
    if (!currentGroup) return [];
    return projects.filter((p) => p.groupId === currentGroup.id);
  }, [projects, currentGroup]);

  const handleSelect = (p: Project) => {
    // Use the kanbanTaskId if available (chat is keyed by kanban task id), else fall back to project id.
    const chatId = p.kanbanTaskId || p.id;
    setActiveChatProject(chatId, p.title);
    setPickerOpen(false);
    // No openChat() call — the chat is always visible (embedded mode).
  };

  return (
    <div className="px-3 pt-2 pb-3 h-full min-h-0 flex flex-col">
      <div
        className="relative flex flex-col h-full overflow-hidden"
        style={{
          borderRadius: '12px',
          background: 'rgba(10,14,23,0.85)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(0,240,255,0.3)',
          boxShadow:
            '0 0 24px rgba(0,240,255,0.15), 0 0 8px rgba(255,0,170,0.1), 0 12px 40px rgba(0,0,0,0.7)',
        }}
      >
        {/* Top accent strip — magenta glow */}
        <div
          className="h-[2px] w-full shrink-0"
          style={{
            background:
              'linear-gradient(90deg, transparent, #ff00aa 30%, #ff00aa 70%, transparent)',
            boxShadow: '0 0 6px rgba(255,0,170,0.6)',
          }}
        />

        {/* Header bar — title */}
        <div
          className="flex items-center justify-between px-3.5 pt-3 pb-3 shrink-0"
          style={{ borderBottom: '1px solid rgba(0,240,255,0.15)' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="flex h-6 w-6 items-center justify-center"
              style={{
                borderRadius: '6px',
                background: 'rgba(0,240,255,0.1)',
                border: '1px solid rgba(0,240,255,0.5)',
                boxShadow: '0 0 12px rgba(0,240,255,0.3)',
              }}
            >
              <MessageCircle
                className="h-3 w-3"
                style={{
                  color: NEON_CYAN,
                  filter: 'drop-shadow(0 0 4px rgba(0,240,255,0.8))',
                }}
              />
            </div>
            <span
              className="text-[10px] font-semibold uppercase tracking-[2px] truncate"
              style={{
                color: NEON_CYAN,
                fontFamily: FONT_MONO,
                textShadow: '0 0 6px rgba(0,240,255,0.4)',
              }}
            >
              Чат проекта
            </span>
          </div>
          {activeChatProjectName && (
            <span
              className="text-[9px] uppercase tracking-[1px] truncate max-w-[100px]"
              style={{
                color: NEON_MAGENTA,
                fontFamily: FONT_MONO,
                textShadow: '0 0 4px rgba(255,0,170,0.4)',
              }}
              title={activeChatProjectName}
            >
              {activeChatProjectName}
            </span>
          )}
        </div>

        {/* Body — project selector at top, embedded chat fills the rest.
            The chat is ALWAYS VISIBLE here (no toggle button, no floating popup).
            When no project is selected, a placeholder prompts the user to pick one. */}
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Project selector dropdown */}
          <div className="px-3.5 pt-3 shrink-0">
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  className="group flex w-full items-center gap-2 px-2.5 py-2 text-left transition-all duration-200"
                  style={{
                    clipPath: YELLOW_BTN_CLIP,
                    background: 'linear-gradient(135deg, rgba(252,238,10,0.95), rgba(241,241,0,0.9) 50%, rgba(252,238,10,0.95))',
                    border: '1px solid rgba(252,238,10,0.9)',
                    boxShadow: '0 0 12px rgba(252,238,10,0.4), inset 0 1px 0 rgba(255,255,255,0.4)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 0 16px rgba(252,238,10,0.6), 0 0 24px rgba(252,238,10,0.2), inset 0 1px 0 rgba(255,255,255,0.5)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 0 12px rgba(252,238,10,0.4), inset 0 1px 0 rgba(255,255,255,0.4)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <FolderOpen
                    className="h-3 w-3 shrink-0"
                    style={{ color: '#000' }}
                  />
                  <span
                    className="flex-1 truncate text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: '#000', fontFamily: FONT_MONO, textShadow: '0 1px 0 rgba(255,255,255,0.3)' }}
                  >
                    {activeChatProjectName || 'Выбрать проект…'}
                  </span>
                  <ChevronDown
                    className="h-3 w-3 shrink-0 transition-transform"
                    style={{
                      color: '#000',
                      transform: pickerOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                sideOffset={4}
                className="p-0 w-[220px] border-0"
                style={{
                  background: 'rgba(10,14,23,0.98)',
                  borderRadius: '12px',
                  border: '1px solid rgba(0,240,255,0.3)',
                  boxShadow:
                    '0 0 16px rgba(0,240,255,0.15), 0 12px 40px rgba(0,0,0,0.7)',
                }}
              >
                <div className="max-h-60 overflow-y-auto custom-scrollbar">
                  {groupProjects.length === 0 ? (
                    <p
                      className="px-3 py-3 text-[10px] italic"
                      style={{ color: '#8892a0', fontFamily: FONT_MONO }}
                    >
                      Нет проектов в группе
                    </p>
                  ) : (
                    groupProjects.map((p) => {
                      const isActive = (p.kanbanTaskId || p.id) === activeChatProjectId;
                      return (
                        <button
                          key={p.id}
                          onClick={() => handleSelect(p)}
                          className="w-full flex items-center gap-2 px-2.5 py-2 text-left transition-colors"
                          style={{
                            background: isActive ? 'rgba(0,240,255,0.12)' : 'transparent',
                            boxShadow: isActive
                              ? `inset 2px 0 0 ${NEON_CYAN}`
                              : 'inset 2px 0 0 transparent',
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) e.currentTarget.style.background = 'rgba(0,240,255,0.06)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <Music2
                            className="h-3 w-3 shrink-0"
                            style={{
                              color: isActive ? NEON_CYAN : NEON_MAGENTA,
                            }}
                          />
                          <span
                            className="flex-1 truncate text-[11px]"
                            style={{ color: '#ffffff', fontFamily: FONT_MONO }}
                          >
                            {p.title}
                          </span>
                          <span
                            className="text-[8px] uppercase tracking-wider"
                            style={{ color: '#8892a0', fontFamily: FONT_MONO }}
                          >
                            {p.type}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Embedded chat — fills the remaining space.
              When no project is selected, show a placeholder instead. */}
          <div className="flex-1 min-h-0 flex flex-col px-1.5 pb-1.5 pt-2">
            {!activeChatProjectId ? (
              <div
                className="flex flex-col items-center justify-center text-center flex-1 mx-2 mb-2"
                style={{
                  borderRadius: '8px',
                  background: 'rgba(10,20,35,0.6)',
                  border: '1px solid rgba(0,240,255,0.2)',
                }}
              >
                <MessageCircle
                  className="h-5 w-5 mb-1.5"
                  style={{
                    color: NEON_CYAN,
                    filter: 'drop-shadow(0 0 4px rgba(0,240,255,0.4))',
                  }}
                />
                <p
                  className="text-[10px] font-medium"
                  style={{ color: '#8892a0', fontFamily: FONT_MONO }}
                >
                  Выберите проект для чата
                </p>
              </div>
            ) : (
              <ProjectChat embedded />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Sidebar content — top logo + collapse button, artist profile,            */
/*  spacer, chat at bottom.                                                    */
/*                                                                             */
/*  Layout:                                                                    */
/*    - When the profile card is COLLAPSED: the card shrinks to its natural    */
/*      height (compact header bar) and the chat section grows to fill the    */
/*      rest of the sidebar.                                                  */
/*    - When the profile card is EXPANDED: both the card and the chat are     */
/*      flex-1 siblings so they split the available height 50/50.             */
/* ────────────────────────────────────────────────────────────────────────── */
function SidebarContent({ onClose }: { onClose?: () => void }) {
  const profileCollapsed = useSidebarStore((s) => s.profileCollapsed);

  return (
    <div className="relative flex h-full flex-col bg-[#05080f] text-slate-100">
      {/* subtle grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage: `linear-gradient(rgba(${NEON_CYAN_RGB},0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(${NEON_CYAN_RGB},0.035) 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      {/* ─── Logo + close button ─── */}
      <div className="relative px-4 py-4 flex items-center gap-2.5 shrink-0">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center"
          style={{
            borderRadius: '8px',
            background: 'rgba(255,0,170,0.1)',
            border: '1px solid rgba(255,0,170,0.5)',
            boxShadow: '0 0 12px rgba(255,0,170,0.2)',
          }}
        >
          <Hexagon
            className="h-4 w-4"
            style={{
              color: NEON_MAGENTA,
              filter: 'drop-shadow(0 0 4px rgba(255,0,170,0.7))',
            }}
          />
        </div>
        <span
          className="text-base font-bold uppercase tracking-[0.18em]"
          style={{
            color: '#ffffff',
            fontFamily: FONT_DISPLAY,
            textShadow: '0 0 8px rgba(255,0,170,0.5), 0 0 20px rgba(0,240,255,0.2)',
          }}
        >
          SoundFlow
        </span>
        {/* Close button — visible on mobile, also used to collapse on desktop */}
        <button
          onClick={onClose}
          aria-label="Свернуть панель"
          className="ml-auto flex h-7 w-7 items-center justify-center transition-all lg:hidden"
          style={{
            borderRadius: '6px',
            background: hexToRgba(RED, 0.06),
            border: `1px solid ${hexToRgba(RED, 0.25)}`,
            color: '#94a3b8',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = hexToRgba(RED, 0.15);
            e.currentTarget.style.borderColor = hexToRgba(RED, 0.6);
            e.currentTarget.style.color = RED;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = hexToRgba(RED, 0.06);
            e.currentTarget.style.borderColor = hexToRgba(RED, 0.25);
            e.currentTarget.style.color = '#94a3b8';
          }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* divider with neon glow */}
      <div
        className="mx-4 mb-1 h-px shrink-0"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(0,240,255,0.4), transparent)',
        }}
      />

      {/* ─── Middle container — profile (top) + chat (bottom) ───
          Both sections are flex children of this container. When the
          profile is collapsed, it shrinks to its natural height; when
          expanded, both are flex-1 so they split the space 50/50. */}
      <div className="relative flex-1 min-h-0 flex flex-col">
        {/* Profile section */}
        <div
          className={cn(
            'min-h-0',
            profileCollapsed ? 'shrink-0' : 'flex-1'
          )}
        >
          <ArtistProfileCard />
        </div>

        {/* Chat section — always grows to fill the available space.
            When the profile is collapsed, this means the chat fills
            nearly the entire sidebar. When expanded, both are flex-1
            so the chat takes exactly half. */}
        <div className="flex-1 min-h-0">
          <SidebarChatSection />
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  AppSidebar — exported component. Renders:                                  */
/*   - The sliding sidebar (artist profile + chat)                             */
/*   - A floating toggle button (visible when sidebar is collapsed/closed)    */
/*   - The global ProjectChat floating panel (rendered OUTSIDE the            */
/*     transform-affected aside so its `position: fixed` is relative to        */
/*     the viewport, not the sidebar)                                          */
/* ────────────────────────────────────────────────────────────────────────── */
export function AppSidebar() {
  const isCollapsed = useSidebarStore((s) => s.isCollapsed);
  const isMobileOpen = useSidebarStore((s) => s.isMobileOpen);
  const toggle = useSidebarStore((s) => s.toggle);
  const toggleMobile = useSidebarStore((s) => s.toggleMobile);
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen);

  // Unified toggle handler — picks the right store based on viewport width.
  const handleToggle = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      toggleMobile();
    } else {
      toggle();
    }
  };

  const handleClose = () => {
    // Close on mobile, collapse on desktop.
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setMobileOpen(false);
    } else {
      toggle();
    }
  };

  return (
    <>
      {/* ─── Sliding sidebar ─── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[360px] flex-col border-r border-[#1a2030] bg-[#05080f] transition-transform duration-300 ease-out',
          // Mobile: hidden by default, slides in when isMobileOpen
          isMobileOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: override — visible unless isCollapsed
          isCollapsed ? 'lg:-translate-x-full' : 'lg:translate-x-0',
          // Always flex on lg, hidden on mobile unless open (still rendered for the slide animation)
          'lg:flex'
        )}
        aria-hidden={isCollapsed && !isMobileOpen}
      >
        <SidebarContent onClose={handleClose} />
      </aside>

      {/* ─── Mobile backdrop — tap to close ─── */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* ─── Floating expand toggle — visible when sidebar is hidden ─── */}
      <AnimatePresence>
        {(isCollapsed || !isMobileOpen) && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.18 }}
            onClick={handleToggle}
            aria-label="Развернуть панель"
            className={cn(
              'fixed top-3 left-3 z-50 flex h-9 w-9 items-center justify-center transition-all',
              // Hide on desktop when sidebar is expanded
              !isCollapsed && 'lg:hidden',
              // Hide on mobile when sidebar is open
              isMobileOpen && 'hidden'
            )}
            style={{
              clipPath: BTN_CLIP,
              background: 'rgba(10,14,22,0.95)',
              boxShadow: `inset 0 0 0 1px rgba(${NEON_MAGENTA_RGB},0.5), 0 0 14px rgba(${NEON_MAGENTA_RGB},0.18)`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = `inset 0 0 0 1px rgba(${NEON_MAGENTA_RGB},0.8), 0 0 18px rgba(${NEON_MAGENTA_RGB},0.35)`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = `inset 0 0 0 1px rgba(${NEON_MAGENTA_RGB},0.5), 0 0 14px rgba(${NEON_MAGENTA_RGB},0.18)`;
            }}
          >
            <ChevronRight
              className="h-4 w-4"
              style={{
                color: NEON_MAGENTA,
                filter: `drop-shadow(0 0 4px rgba(${NEON_MAGENTA_RGB},0.6))`,
              }}
            />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ─── Floating collapse toggle — visible when sidebar is shown on desktop ─── */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.18 }}
            onClick={handleToggle}
            aria-label="Свернуть панель"
            className="hidden lg:flex fixed top-3 left-[348px] z-50 h-7 w-5 items-center justify-center transition-all"
            style={{
              clipPath: BTN_CLIP,
              background: 'rgba(10,14,22,0.95)',
              boxShadow: `inset 0 0 0 1px rgba(${NEON_CYAN_RGB},0.4)`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = `inset 0 0 0 1px rgba(${NEON_CYAN_RGB},0.8), 0 0 12px rgba(${NEON_CYAN_RGB},0.25)`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = `inset 0 0 0 1px rgba(${NEON_CYAN_RGB},0.4)`;
            }}
          >
            <ChevronsLeft
              className="h-3 w-3"
              style={{ color: NEON_CYAN }}
            />
          </motion.button>
        )}
      </AnimatePresence>

      {/* The floating <ProjectChat/> panel is no longer rendered here —
          the chat is now ALWAYS VISIBLE inside the sidebar (embedded mode).
          See SidebarChatSection → <ProjectChat embedded />. */}
    </>
  );
}
