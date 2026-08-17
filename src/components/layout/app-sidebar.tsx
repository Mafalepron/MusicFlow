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
  Send,
  Calendar,
  ChevronDown,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useNavigationStore, useAuthStore, useDataStore, type Group, type Project } from '@/lib/store';
import { useSidebarStore } from '@/store/sidebar-store';
import { useChatContextStore } from '@/store/chat-context-store';
import { useChatUIStore } from '@/store/chat-ui-store';
import ProjectChat from '@/components/chat/project-chat';
import { hexToRgba } from '@/lib/utils';
import { cn } from '@/lib/utils';

/* ─── cyberpunk palette ─── */
const YELLOW = '#c7a008';
const CYAN = '#00a8c6';
const PURPLE = '#7b2cbf';
const RED = '#EF4444';
const GREEN = '#10B981';
const AMBER = '#F59E0B';

const CARD_CLIP =
  'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))';
const BTN_CLIP =
  'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))';
const AVATAR_CLIP =
  'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)';

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
          clipPath: BTN_CLIP,
          background: hexToRgba(CYAN, 0.08),
          boxShadow: `inset 0 0 0 1px ${hexToRgba(CYAN, 0.3)}`,
        }}
      >
        <ChevronLeft className="h-3.5 w-3.5" style={{ color: CYAN }} />
      </button>
      <span
        className="text-[10px] uppercase tracking-[0.18em] font-bold"
        style={{ color: hexToRgba('#e2e8f0', 0.7) }}
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
          clipPath: BTN_CLIP,
          background: hexToRgba(CYAN, 0.08),
          boxShadow: `inset 0 0 0 1px ${hexToRgba(CYAN, 0.3)}`,
        }}
      >
        <ChevronRight className="h-3.5 w-3.5" style={{ color: CYAN }} />
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
          className="w-full resize-none rounded-md bg-[#070b14] px-2 py-1.5 text-[11px] leading-relaxed text-slate-200 placeholder:text-slate-600 focus:outline-none"
          style={{
            clipPath: BTN_CLIP,
            boxShadow: `inset 0 0 0 1px ${hexToRgba(CYAN, 0.5)}`,
          }}
        />
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-wider text-slate-600">
            {saving ? 'Сохранение…' : '⌘/Ctrl+Enter — сохранить · Esc — отмена'}
          </span>
          <span className="text-[9px] tabular-nums text-slate-600">{draft.length}/500</span>
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
        className="relative px-2 py-1.5 text-[11px] leading-relaxed text-slate-300 transition-all"
        style={{
          clipPath: BTN_CLIP,
          background: hexToRgba(CYAN, 0.04),
          boxShadow: `inset 0 0 0 1px ${hexToRgba(CYAN, 0.18)}`,
        }}
      >
        {group?.description?.trim() ? (
          <p className="whitespace-pre-wrap break-words pr-5">{group.description}</p>
        ) : (
          <p className="italic text-slate-500 pr-5">Нет описания. Нажмите, чтобы добавить…</p>
        )}
        <Pencil
          className="absolute right-1.5 top-1.5 h-3 w-3 text-slate-600 opacity-0 transition-opacity group-hover:opacity-100"
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
          className="p-3 text-center text-[11px] text-slate-500"
          style={{
            clipPath: CARD_CLIP,
            background: 'rgba(8,12,22,0.9)',
            boxShadow: `inset 0 0 0 1px ${hexToRgba(CYAN, 0.2)}`,
          }}
        >
          Группа не выбрана
        </div>
      </div>
    );
  }

  const stats: { icon: typeof Users; label: string; value: number; color: string }[] = [
    { icon: Users, label: 'Участн.', value: memberCount, color: CYAN },
    { icon: FolderOpen, label: 'Проекты', value: groupProjects.length, color: YELLOW },
    { icon: Music2, label: 'Треки', value: groupTrackCount, color: AMBER },
    { icon: Lightbulb, label: 'Идеи', value: groupIdeaCount, color: GREEN },
  ];

  return (
    <div className="relative px-3 py-3">
      <div
        className="relative p-3"
        style={{
          clipPath: CARD_CLIP,
          background:
            'linear-gradient(160deg, rgba(10,14,22,0.95) 0%, rgba(8,12,20,0.85) 100%)',
          boxShadow: `inset 0 0 0 1px ${hexToRgba(CYAN, 0.3)}, 0 0 18px ${hexToRgba(CYAN, 0.06)}`,
        }}
      >
        {/* Top accent stripe */}
        <div
          className="absolute left-0 right-0 top-0 h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${hexToRgba(YELLOW, 0.6)}, transparent)`,
          }}
        />

        {/* Avatar + switcher row */}
        <div className="flex flex-col items-center pt-1">
          <div
            className="relative flex h-16 w-16 items-center justify-center"
            style={{
              clipPath: AVATAR_CLIP,
              background: hexToRgba(YELLOW, 0.1),
              boxShadow: `inset 0 0 0 1.5px ${hexToRgba(YELLOW, 0.5)}, 0 0 18px ${hexToRgba(YELLOW, 0.15)}`,
            }}
          >
            <Avatar className="h-14 w-14" style={{ borderRadius: 0 }}>
              <AvatarImage src={currentGroup.avatarUrl} alt={currentGroup.name} />
              <AvatarFallback
                className="bg-transparent text-lg font-bold"
                style={{
                  color: YELLOW,
                  textShadow: `0 0 8px ${hexToRgba(YELLOW, 0.6)}`,
                }}
              >
                {currentGroup.name?.charAt(0)?.toUpperCase() || 'G'}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Group switcher — only when multiple groups */}
          <GroupSwitcher
            groups={userGroups}
            currentIndex={currentIndex}
            onSelect={handleSwitchGroup}
          />
        </div>

        {/* Group name + genre */}
        <div className="mt-2 text-center">
          <p
            className="truncate text-sm font-bold uppercase tracking-[0.14em]"
            style={{
              color: YELLOW,
              textShadow: `0 0 8px ${hexToRgba(YELLOW, 0.5)}`,
            }}
            title={currentGroup.name}
          >
            {currentGroup.name}
          </p>
          {currentGroup.genre && (
            <p
              className="mt-0.5 text-[10px] uppercase tracking-[0.18em] font-medium"
              style={{ color: CYAN }}
            >
              <Disc3 className="inline h-2.5 w-2.5 mr-1 -mt-0.5" style={{ color: CYAN }} />
              {currentGroup.genre}
            </p>
          )}
        </div>

        {/* Invite code (small, with copy) */}
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
          <div className="flex items-center gap-1.5 mb-1.5">
            <div
              className="flex h-3.5 w-3.5 items-center justify-center"
              style={{
                clipPath: BTN_CLIP,
                background: hexToRgba(PURPLE, 0.18),
                boxShadow: `inset 0 0 0 1px ${hexToRgba(PURPLE, 0.5)}`,
              }}
            >
              <Calendar className="h-2 w-2" style={{ color: PURPLE }} />
            </div>
            <span
              className="text-[9px] font-bold uppercase tracking-[0.18em]"
              style={{ color: PURPLE }}
            >
              Показатели
            </span>
            <div
              className="flex-1 h-px"
              style={{ background: `linear-gradient(90deg, ${hexToRgba(PURPLE, 0.4)}, transparent)` }}
            />
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {stats.map((s) => (
              <div
                key={s.label}
                className="flex flex-col items-center py-1.5"
                style={{
                  clipPath: BTN_CLIP,
                  background: hexToRgba(s.color, 0.05),
                  boxShadow: `inset 0 0 0 1px ${hexToRgba(s.color, 0.2)}`,
                }}
              >
                <s.icon className="h-3 w-3 mb-0.5" style={{ color: s.color }} />
                <span
                  className="text-sm font-bold tabular-nums leading-none"
                  style={{ color: '#e2e8f0' }}
                >
                  {s.value}
                </span>
                <span
                  className="mt-0.5 text-[8px] uppercase tracking-wider font-medium"
                  style={{ color: hexToRgba('#94a3b8', 0.8) }}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
          <div
            className="mt-2 flex items-center gap-1.5 px-1.5 py-1"
            style={{
              clipPath: BTN_CLIP,
              background: hexToRgba(CYAN, 0.04),
              boxShadow: `inset 0 0 0 1px ${hexToRgba(CYAN, 0.15)}`,
            }}
          >
            <Calendar className="h-2.5 w-2.5" style={{ color: CYAN }} />
            <span className="text-[9px] uppercase tracking-wider text-slate-400">
              Создан:
            </span>
            <span className="ml-auto text-[9px] tabular-nums text-slate-300 font-medium">
              {createdLabel}
            </span>
          </div>
        </div>

        {/* Linked projects section */}
        <div className="mt-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <FolderOpen className="h-3 w-3" style={{ color: YELLOW }} />
            <span
              className="text-[9px] font-bold uppercase tracking-[0.18em]"
              style={{ color: YELLOW }}
            >
              Проекты группы
            </span>
            <span className="ml-auto text-[9px] tabular-nums text-slate-500">
              {groupProjects.length}
            </span>
          </div>
          {groupProjects.length === 0 ? (
            <p className="text-[10px] text-slate-600 italic px-1">Нет проектов</p>
          ) : (
            <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-1">
              {groupProjects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate('project-detail', p.id)}
                  className="group/proj flex w-full items-center gap-2 px-2 py-1.5 text-left transition-all"
                  style={{
                    clipPath: BTN_CLIP,
                    background: hexToRgba(CYAN, 0.04),
                    boxShadow: `inset 0 0 0 1px ${hexToRgba(CYAN, 0.15)}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = hexToRgba(CYAN, 0.1);
                    e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${hexToRgba(CYAN, 0.4)}`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = hexToRgba(CYAN, 0.04);
                    e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${hexToRgba(CYAN, 0.15)}`;
                  }}
                  title={`Открыть: ${p.title}`}
                >
                  <span
                    className="flex h-4 w-4 shrink-0 items-center justify-center"
                    style={{
                      clipPath: BTN_CLIP,
                      background: hexToRgba(YELLOW, 0.12),
                      boxShadow: `inset 0 0 0 1px ${hexToRgba(YELLOW, 0.4)}`,
                    }}
                  >
                    <Music2 className="h-2 w-2" style={{ color: YELLOW }} />
                  </span>
                  <span className="flex-1 truncate text-[10px] text-slate-300 group-hover/proj:text-slate-100">
                    {p.title}
                  </span>
                  <span
                    className="text-[8px] uppercase tracking-wider"
                    style={{ color: hexToRgba(CYAN, 0.7) }}
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
        className="flex-1 px-2 py-1 font-mono text-[10px] tracking-wider"
        style={{
          clipPath: BTN_CLIP,
          background: hexToRgba(CYAN, 0.08),
          color: CYAN,
          boxShadow: `inset 0 0 0 1px ${hexToRgba(CYAN, 0.3)}`,
          textShadow: `0 0 6px ${hexToRgba(CYAN, 0.4)}`,
        }}
      >
        {code}
      </code>
      <button
        onClick={handleCopy}
        aria-label="Copy invite code"
        className="flex h-6 w-6 items-center justify-center transition-all"
        style={{
          clipPath: BTN_CLIP,
          background: hexToRgba(CYAN, 0.06),
          boxShadow: `inset 0 0 0 1px ${hexToRgba(CYAN, 0.25)}`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = hexToRgba(CYAN, 0.15);
          e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${hexToRgba(CYAN, 0.5)}`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = hexToRgba(CYAN, 0.06);
          e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${hexToRgba(CYAN, 0.25)}`;
        }}
      >
        {copied ? (
          <Check className="h-3 w-3" style={{ color: GREEN }} />
        ) : (
          <Copy className="h-3 w-3" style={{ color: CYAN }} />
        )}
      </button>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Project chat section — lives at the bottom of the sidebar.                */
/*  - Project selector dropdown at top                                          */
/*  - "Выберите проект для чата" placeholder when no project selected          */
/*  - Embeds <ProjectChat/> so its floating panel renders when isOpen          */
/* ────────────────────────────────────────────────────────────────────────── */
function SidebarChatSection() {
  const projects = useDataStore((s) => s.projects);
  const currentGroup = useDataStore((s) => s.currentGroup);
  const { activeChatProjectId, activeChatProjectName, setActiveChatProject } = useChatContextStore();
  const { open: openChat, isOpen: chatIsOpen, close: closeChat } = useChatUIStore();
  const [pickerOpen, setPickerOpen] = useState(false);

  // Projects linked to the current group.
  const groupProjects = useMemo<Project[]>(() => {
    if (!currentGroup) return [];
    return projects.filter((p) => p.groupId === currentGroup.id);
  }, [projects, currentGroup]);

  // Auto-select the first project if none is selected.
  useEffect(() => {
    if (!activeChatProjectId && groupProjects.length > 0) {
      // Don't auto-set — let user pick. Per spec: placeholder when no project selected.
    }
  }, [activeChatProjectId, groupProjects.length]);

  const handleSelect = (p: Project) => {
    // Use the kanbanTaskId if available (chat is keyed by kanban task id), else fall back to project id.
    const chatId = p.kanbanTaskId || p.id;
    setActiveChatProject(chatId, p.title);
    setPickerOpen(false);
    // Auto-open the floating chat panel.
    openChat();
  };

  return (
    <div className="relative px-3 pb-3 pt-2 border-t" style={{ borderColor: hexToRgba(CYAN, 0.15) }}>
      {/* Section header */}
      <div className="flex items-center gap-1.5 mb-2 px-0.5">
        <div
          className="flex h-3.5 w-3.5 items-center justify-center"
          style={{
            clipPath: BTN_CLIP,
            background: hexToRgba(CYAN, 0.15),
            boxShadow: `inset 0 0 0 1px ${hexToRgba(CYAN, 0.5)}`,
          }}
        >
          <MessageCircle className="h-2 w-2" style={{ color: CYAN }} />
        </div>
        <span
          className="text-[9px] font-bold uppercase tracking-[0.18em]"
          style={{ color: CYAN }}
        >
          Чат проекта
        </span>
        <div
          className="flex-1 h-px"
          style={{ background: `linear-gradient(90deg, ${hexToRgba(CYAN, 0.4)}, transparent)` }}
        />
      </div>

      {/* Project selector dropdown */}
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <button
            className="group flex w-full items-center gap-2 px-2 py-1.5 text-left transition-all"
            style={{
              clipPath: BTN_CLIP,
              background: hexToRgba(CYAN, 0.05),
              boxShadow: `inset 0 0 0 1px ${hexToRgba(CYAN, 0.25)}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = hexToRgba(CYAN, 0.1);
              e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${hexToRgba(CYAN, 0.5)}`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = hexToRgba(CYAN, 0.05);
              e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${hexToRgba(CYAN, 0.25)}`;
            }}
          >
            <FolderOpen className="h-3 w-3 shrink-0" style={{ color: YELLOW }} />
            <span className="flex-1 truncate text-[11px] text-slate-200">
              {activeChatProjectName || 'Выбрать проект…'}
            </span>
            <ChevronDown
              className="h-3 w-3 shrink-0 transition-transform"
              style={{
                color: CYAN,
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
            background: 'rgba(8,12,22,0.98)',
            clipPath: CARD_CLIP,
            boxShadow: `inset 0 0 0 1px ${hexToRgba(CYAN, 0.3)}, 0 8px 24px rgba(0,0,0,0.6)`,
          }}
        >
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {groupProjects.length === 0 ? (
              <p className="px-3 py-3 text-[10px] text-slate-500 italic">
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
                      background: isActive ? hexToRgba(CYAN, 0.12) : 'transparent',
                      boxShadow: isActive
                        ? `inset 2px 0 0 ${CYAN}`
                        : 'inset 2px 0 0 transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = hexToRgba(CYAN, 0.06);
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <Music2 className="h-3 w-3 shrink-0" style={{ color: isActive ? CYAN : YELLOW }} />
                    <span className="flex-1 truncate text-[11px] text-slate-200">
                      {p.title}
                    </span>
                    <span
                      className="text-[8px] uppercase tracking-wider"
                      style={{ color: hexToRgba('#94a3b8', 0.8) }}
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

      {/* Chat body — placeholder when no project selected, otherwise
          show a compact "open chat" / "chat active" panel. */}
      <div className="mt-2">
        {!activeChatProjectId ? (
          <div
            className="flex flex-col items-center justify-center py-5 text-center"
            style={{
              clipPath: CARD_CLIP,
              background: hexToRgba(CYAN, 0.03),
              boxShadow: `inset 0 0 0 1px ${hexToRgba(CYAN, 0.15)}`,
            }}
          >
            <MessageCircle
              className="h-5 w-5 mb-1.5"
              style={{ color: hexToRgba(CYAN, 0.4) }}
            />
            <p className="text-[10px] text-slate-400 font-medium">
              Выберите проект для чата
            </p>
          </div>
        ) : (
          <button
            onClick={() => (chatIsOpen ? closeChat() : openChat())}
            className="group flex w-full items-center gap-2 px-2 py-2 transition-all"
            style={{
              clipPath: BTN_CLIP,
              background: chatIsOpen
                ? hexToRgba(CYAN, 0.18)
                : hexToRgba(YELLOW, 0.08),
              boxShadow: chatIsOpen
                ? `inset 0 0 0 1px ${hexToRgba(CYAN, 0.6)}, 0 0 12px ${hexToRgba(CYAN, 0.15)}`
                : `inset 0 0 0 1px ${hexToRgba(YELLOW, 0.4)}`,
            }}
            onMouseEnter={(e) => {
              if (!chatIsOpen) {
                e.currentTarget.style.background = hexToRgba(YELLOW, 0.15);
                e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${hexToRgba(YELLOW, 0.6)}, 0 0 12px ${hexToRgba(YELLOW, 0.15)}`;
              }
            }}
            onMouseLeave={(e) => {
              if (!chatIsOpen) {
                e.currentTarget.style.background = hexToRgba(YELLOW, 0.08);
                e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${hexToRgba(YELLOW, 0.4)}`;
              }
            }}
          >
            <Send
              className="h-3 w-3 shrink-0"
              style={{ color: chatIsOpen ? CYAN : YELLOW }}
            />
            <span
              className="flex-1 truncate text-left text-[11px] font-semibold"
              style={{ color: chatIsOpen ? CYAN : YELLOW }}
            >
              {chatIsOpen ? 'Чат открыт — скрыть' : 'Открыть чат'}
            </span>
            <span
              className="text-[9px] uppercase tracking-wider truncate max-w-[80px]"
              style={{ color: chatIsOpen ? hexToRgba(CYAN, 0.8) : hexToRgba(YELLOW, 0.8) }}
              title={activeChatProjectName || ''}
            >
              {activeChatProjectName}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Sidebar content — top logo + collapse button, artist profile,            */
/*  spacer, chat at bottom.                                                    */
/* ────────────────────────────────────────────────────────────────────────── */
function SidebarContent({ onClose }: { onClose?: () => void }) {
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

      {/* ─── Logo + close button ─── */}
      <div className="relative px-4 py-4 flex items-center gap-2.5">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center"
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
        {/* Close button — visible on mobile, also used to collapse on desktop */}
        <button
          onClick={onClose}
          aria-label="Свернуть панель"
          className="ml-auto flex h-7 w-7 items-center justify-center transition-all lg:hidden"
          style={{
            clipPath: BTN_CLIP,
            background: hexToRgba(RED, 0.06),
            boxShadow: `inset 0 0 0 1px ${hexToRgba(RED, 0.25)}`,
            color: '#94a3b8',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = hexToRgba(RED, 0.15);
            e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${hexToRgba(RED, 0.6)}`;
            e.currentTarget.style.color = RED;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = hexToRgba(RED, 0.06);
            e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${hexToRgba(RED, 0.25)}`;
            e.currentTarget.style.color = '#94a3b8';
          }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* divider with cyan glow */}
      <div
        className="mx-4 mb-1 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${hexToRgba(CYAN, 0.4)}, transparent)`,
        }}
      />

      {/* ─── Artist profile (scrollable) ─── */}
      <ScrollArea className="relative flex-1">
        <ArtistProfileCard />
      </ScrollArea>

      {/* ─── Project chat at the bottom ─── */}
      <SidebarChatSection />
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
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-[#1a2030] bg-[#05080f] transition-transform duration-300 ease-out',
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
              boxShadow: `inset 0 0 0 1px ${hexToRgba(YELLOW, 0.5)}, 0 0 14px ${hexToRgba(YELLOW, 0.18)}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${hexToRgba(YELLOW, 0.8)}, 0 0 18px ${hexToRgba(YELLOW, 0.35)}`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${hexToRgba(YELLOW, 0.5)}, 0 0 14px ${hexToRgba(YELLOW, 0.18)}`;
            }}
          >
            <ChevronRight
              className="h-4 w-4"
              style={{
                color: YELLOW,
                filter: `drop-shadow(0 0 4px ${hexToRgba(YELLOW, 0.6)})`,
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
            className="hidden lg:flex fixed top-3 left-[228px] z-50 h-7 w-5 items-center justify-center transition-all"
            style={{
              clipPath: BTN_CLIP,
              background: 'rgba(10,14,22,0.95)',
              boxShadow: `inset 0 0 0 1px ${hexToRgba(CYAN, 0.4)}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${hexToRgba(CYAN, 0.8)}, 0 0 12px ${hexToRgba(CYAN, 0.25)}`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${hexToRgba(CYAN, 0.4)}`;
            }}
          >
            <ChevronsLeft
              className="h-3 w-3"
              style={{ color: CYAN }}
            />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ─── Global ProjectChat floating panel ─── */}
      {/* Rendered OUTSIDE the transform-affected <aside> so its `position: fixed`
          is relative to the viewport (transformed ancestors become the
          containing block for fixed descendants — we don't want that). */}
      <ProjectChat />
    </>
  );
}
