---
Task ID: HOME-REDESIGN
Agent: main (Z.ai Code)
Task: Redesign home page, sidebar, and main app layout in cyberpunk 2077 style for SoundFlow music collaboration app

Work Log:
- Read /home/z/my-project/worklog.md to load project context: existing cyberpunk 2077 Kanban workspace with central `src/app/cyberpunk.css` (1226 lines), CSS variables `--bc-X` set on component roots, all `<style jsx global>` and `dangerouslySetInnerHTML` blocks forbidden (Turbopack OOM).
- Read /home/z/my-project/src/components/views/home-view.tsx (301 lines): existing default shadcn/ui theme — light cards, rounded corners, purple (#8A2BE2) accents, English-only labels. Used `useAuthStore`, `useDataStore`, `useNavigationStore`. No kanban integration.
- Read /home/z/my-project/src/components/layout/app-sidebar.tsx (189 lines): default theme — rounded-lg, purple primary, square buttons, `bg-sidebar`/`bg-[#1E1E28]` cards.
- Read /home/z/my-project/src/lib/store.ts to verify stores: `useNavigationStore.navigate(view, projectId?, trackId?)`, `useDataStore.{projects, ideas, tracks, currentGroup, notificationCount}`, `Project.kanbanTaskId?: string | null`.
- Read /home/z/my-project/src/store/kanban-store.ts to verify `useKanbanStore.{projects, selectProject(id), setProjects}` API and `Task` interface (`soundflowProjectId`, `children: TaskChild[]`, `projectType`, `status`).
- Read /home/z/my-project/src/components/kanban/kanban-view.tsx to confirm the navigate-to-kanban-project pattern: `navigate('kanban')` then `setTimeout(() => useKanbanStore.getState().selectProject(kanbanProjectId), 220)`. Confirmed by reading project-detail-view.tsx:118-121 which uses the same pattern with a 300ms delay.
- Read /home/z/my-project/src/app/api/tasks/route.ts to verify GET `?parentId=null` returns `{ tasks: [...] }` of all top-level `isProject=true` tasks with `soundflowProjectId` joined from the Project relation.
- Read /home/z/my-project/src/lib/utils.ts to confirm `hexToRgba(hex, alpha)` helper exists — used for dynamic per-card color tinting without template-literal CSS.
- Read /home/z/my-project/src/app/page.tsx (207 lines) to understand the layout wrapper: `<div className="min-h-screen bg-background">` (bg=#0B0B0F from globals.css) → `<AppSidebar />` + `<div className="lg:pl-60 flex min-h-screen flex-col">` → `<AppHeader h-14>` + `<main className="flex-1 p-4 lg:p-6">` + `<footer className="border-t ... mt-auto">`. The home-view is wrapped in `<motion.div key=activeView {...viewTransition}>` so it cannot use `h-full` reliably — used `min-h-[calc(100dvh-3.5rem)]` instead.
- Confirmed AppHeader height is `h-14` (3.5rem = 56px) by reading app-header.tsx:209.

EDITS — /home/z/my-project/src/components/views/home-view.tsx (661 lines):
- Added imports: `AnimatePresence` from framer-motion; `ChevronDown, ChevronRight, Hexagon, Folder, Disc3, Plus` from lucide-react; `useKanbanStore, type Task` from `@/store/kanban-store`; `hexToRgba` from `@/lib/utils`.
- Removed unused imports: `Card, CardContent`, `Badge`, `ScrollArea`, `ArrowRight` was kept (used in section actions).
- Defined cyberpunk palette constants: YELLOW=#FCEE0A, CYAN=#00d9ff, AMBER=#F59E0B, GREEN=#10B981, CARD_BG='rgba(8,12,22,0.9)'.
- Defined clip-path constants: CARD_CLIP (6px corner cut), BTN_CLIP (4px corner cut).
- Replaced English labels with Russian: typeLabels {album:'Альбом', ep:'EP', single:'Сингл', general:'Общее'}, statusLabels {draft:'Черновик', in_progress:'В работе', mixing:'Сведение', mastering:'Мастеринг', released:'Релиз'}.
- Replaced purple/blue status colors with cyberpunk palette: draft=#F59E0B (amber), in_progress=#00d9ff (cyan), mixing=#ff6b35 (orange — replaced the old #8A2BE2 violet), mastering=#10B981 (green), released=#FCEE0A (yellow).
- Added `pluralize(n, [one, few, many])` Russian plural helper for "трек/трека/треков", "этап/этапа/этапов", "проект/проекта/проектов".
- Added `NeonCard` reusable component: dark bg `rgba(8,12,22,0.9)`, clip-path CARD_CLIP, inline `box-shadow` with color-tinted inset border (0.3 alpha default → 0.6 on hover) + outer glow (0.06 → 0.22 on hover), 200ms transition. Uses `useState` for hovered flag (no CSS-in-JS).
- Added `SectionTitle` component: uppercase tracking-[0.12em], font-bold, text-shadow glow in section color, optional action slot.
- Added `EmptyState` component: clip-path card with dimmed icon + label + optional hint.
- Added `IdeaCard` separate component (so each card has its own useState for hover — needed for horizontal scroll cards with different colors per hover state).
- Rewrote HomeView:
  * Root: `<div className="relative min-h-[calc(100dvh-3.5rem)] overflow-hidden bg-[#05080f]">` with two absolute overlay layers — a 32px cyan grid (0.04 alpha) + a 2px scanline pattern (0.012 alpha).
  * Header: "Welcome back, {name}" in YELLOW uppercase tracking-[0.08em] with text-shadow `0 0 12px rgba(252,238,10,0.45), 0 0 32px rgba(252,238,10,0.2)`. Group name below in CYAN uppercase tracking-[0.18em] with cyan glow.
  * Stats grid (4 cards via NeonCard): Projects (yellow), Tracks (cyan), Ideas (amber), Members (green). Each card has a small BTN_CLIP icon box with color-tinted bg + border + drop-shadow on icon, large tabular-nums value, uppercase tracking-[0.18em] label.
  * Auto Projects section (АВТО ПРОЕКТЫ): filters `projects.filter(p => p.kanbanTaskId)`. Each card has absolute 3px left accent line in status color (with 8px box-shadow glow), uppercased title, type badge (Альбом/EP/Сингл) in BTN_CLIP with color-tinted bg + border, track count (with pluralized Russian), status label in status color. Click → `goToKanbanProject(project.kanbanTaskId)`. Action button "Создать" in yellow → navigate('projects').
  * Kanban Projects section (КАНБАН ПРОЕКТЫ): fetches `/api/tasks?parentId=null` once on mount, stores in `kanbanProjects` state AND `useKanbanStore.getState().setProjects(tasks)` (so navigation to kanban is fast). Each card shows AUTO/KANBAN badge (yellow if has soundflowProjectId, cyan otherwise), projectType meta, title, child stage count (pluralized), completion % in board color, and a 1px progress bar with color-tinted glow. Click → `goToKanbanProject(task.id)`. Action button "Все доски →" → navigate('kanban').
  * My Project Folders section (МОИ ПАПКИ): groups SoundFlow `projects` by type into 4 cards (Album=yellow, EP=cyan, Single=amber, General=green). Each NeonCard has a folder-icon header button with chevron; clicking toggles expand. AnimatePresence animates height 0↔auto. Expanded view shows inner project list (each project = small BTN_CLIP button with title + status in status color, click → navigate('project-detail', p.id)).
  * Idea Feed section (ЛЕНТА ИДЕЙ): horizontal scroll (`overflow-x-auto`, thin scrollbar) of recent 8 ideas. Each IdeaCard: BTN_CLIP dark card, lightbulb icon + "ИДЕЯ" label in amber, title (1-line clamp), description (2-line clamp with min-height), date in ru-RU format. Click → navigate('ideas'). Action button "Все идеи →" in amber.
- `goToKanbanProject(id)` helper: `navigate('kanban')` then `setTimeout(() => useKanbanStore.getState().selectProject(id), 220)` — matches the pattern used in project-detail-view.tsx.

EDITS — /home/z/my-project/src/components/layout/app-sidebar.tsx (382 lines):
- Added imports: `Hexagon` from lucide-react, `hexToRgba` from `@/lib/utils`.
- Removed unused `Music` import (was for old logo), `Separator`, `Button` imports.
- Defined same palette constants (YELLOW, CYAN, RED=#EF4444, GREEN=#10B981) and clip-paths (CARD_CLIP, BTN_CLIP, plus NAV_CLIP for nav buttons).
- Extracted `NavItem` as a separate component (so each item manages its own hover state via `useState`). Each item: BTN_CLIP-shaped button, 2px left border (yellow when active, cyan on hover, transparent otherwise), background tint (yellow-0.08 when active, cyan-0.06 on hover), icon with drop-shadow glow when active/hovered, uppercase tracking-[0.12em] label. Notification badge: BTN_CLIP, yellow bg/border, 9px font.
- Extracted Tooltip styling: dark `rgba(8,12,22,0.95)` bg with color-tinted border (cyan default, red for logout).
- Rewrote SidebarContent:
  * Root: `<div className="relative flex h-full flex-col bg-[#05080f] text-slate-100">` with absolute 24px cyan grid (0.035 alpha) overlay.
  * Logo: Hexagon icon in BTN_CLIP box with yellow bg-tint (0.12) + yellow border (0.5) + 12px yellow outer glow. "SOUNDFLOW" text in YELLOW uppercase tracking-[0.18em] with text-shadow `0 0 8px rgba(252,238,10,0.5), 0 0 20px rgba(252,238,10,0.2)`.
  * Divider: 1px gradient line `linear-gradient(90deg, transparent, rgba(0,217,255,0.4), transparent)`.
  * Group info card: CARD_CLIP dark bg with cyan border (0.3) + cyan glow. Group name in uppercase tracking-[0.14em]. Invite code in BTN_CLIP monospace box with cyan bg-tint (0.08) + cyan border (0.3) + cyan text-shadow glow. Copy button: BTN_CLIP, cyan tint, opacity 0.7→1 on hover/copy, shows green Check when copied.
  * Navigation: ScrollArea wraps `space-y-1.5` of NavItems. Settings also rendered as NavItem.
  * User section: BTN_CLIP avatar frame with cyan tint bg + cyan border, holding Avatar component inside. User name in uppercase tracking-wider, email in uppercase tracking-wider text-slate-500. Logout button: BTN_CLIP with RED tint (0.06) + RED border (0.25) by default; on hover (via inline onMouseEnter/onMouseLeave) switches to RED tint (0.15) + RED border (0.6) + 12px RED outer glow + RED text color. Tooltip with RED-tinted border.
- Updated AppSidebar export: `<aside className="hidden lg:fixed lg:inset-y-0 lg:z-30 lg:flex lg:w-60 lg:flex-col border-r border-[#1a2030] bg-[#05080f]">` — explicit dark bg + dark slate border (replaces old `bg-sidebar` purple-tinted dark).

Verification:
- `cd /home/z/my-project && bun run lint 2>&1 | grep -E "home-view|app-sidebar"` → empty output (no errors, no warnings for both files). Only 2 pre-existing errors remain in unrelated files (project-chat.tsx:557 and app-header.tsx:132 — both `react-hooks/set-state-in-effect`, not caused by my changes).
- `npx tsc --noEmit --skipLibCheck 2>&1 | grep -E "home-view|app-sidebar"` → empty output (no TypeScript errors).
- Fixed transient compile error: initial draft of home-view.tsx had `void RED;` at the bottom but had removed `const RED = '#EF4444'` earlier. This caused a `ReferenceError: RED is not defined` at runtime (visible in dev.log line 514, "GET / 500 in 791ms"). Removed the trailing `void RED;` line — error cleared, dev server now serves `/` with HTTP 200.
- dev.log tail shows successful API calls from the new home view: `GET /api/groups/.../members 200` (member count fetch), `GET /api/tasks?parentId=null 200` (kanban projects fetch). No compile errors, no 5xx responses after the fix.
- File sizes: home-view.tsx = 661 lines (over the 500-line soft target, but the bulk is unavoidable — 6 sections × stat/empty/card components × Russian plural helper × clip-path constants). app-sidebar.tsx = 382 lines.
- All text labels in Russian per spec (АВТО ПРОЕКТЫ, КАНБАН ПРОЕКТЫ, МОИ ПАПКИ, ЛЕНТА ИДЕЙ, Альбом/EP/Сингл, Черновик/В работе/Сведение/Мастеринг/Релиз). Welcome message and stat labels in English per spec.
- All colors follow cyberpunk palette: YELLOW #FCEE0A for active/important (logo, active nav, welcome header, auto projects), CYAN #00d9ff for default (kanban projects, invite code, nav hover, dividers), AMBER for ideas, GREEN for members/done, RED for logout. No purple/violet anywhere.
- All cards use `clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))` — no rounded corners.
- All borders implemented via `inset 0 0 0 1px {hexToRgba(color, alpha)}` box-shadow (because clip-path cuts CSS borders).
- All hover effects: 200ms transition, color alpha 0.3 → 0.6, glow size 16-18px → 24-28px, alpha 0.06-0.08 → 0.18-0.22.
- All section titles: uppercase, tracking-[0.12em], font-bold, with text-shadow glow in section color.
- All labels: uppercase tracking-[0.12em-0.18em] font-bold, with text-shadow glow where colored.

Stage Summary:
- HomeView now displays 6 cyberpunk-styled sections: Header (yellow welcome + cyan group), Stats grid (4 color-coded cards), АВТО ПРОЕКТЫ (SoundFlow projects linked to kanban via kanbanTaskId), КАНБАН ПРОЕКТЫ (all kanban top-level tasks fetched from /api/tasks?parentId=null, with completion progress bar), МОИ ПАПКИ (4 collapsible folder cards by type with animated expand), ЛЕНТА ИДЕЙ (horizontal scroll of recent ideas).
- Clicking any auto-project or kanban-project card navigates to the kanban view and selects that project (via `useKanbanStore.getState().selectProject(id)` after a 220ms delay).
- AppSidebar now has cyberpunk styling: dark `#05080f` bg with cyan grid overlay, yellow glowing SOUNDFLOW logo with Hexagon icon, BTN_CLIP nav items with yellow active state + left border glow + drop-shadow on icons, cyan invite code in monospace BTN_CLIP box, BTN_CLIP avatar frame with cyan tint, RED logout button with hover glow.
- All existing functionality preserved: navigation (home/ideas/projects/kanban/settings), invite code copy, member count fetch, notification badge, logout, project detail navigation from folders, kanban project navigation from cards.
- No `<style jsx>` or `dangerouslySetInnerHTML` blocks added. All dynamic colors use inline `style={{...}}` with `hexToRgba()` calls — runtime React evaluation, not compile-time template literals.
- Lint clean, TSC clean, dev server responds HTTP 200 on `/`.
