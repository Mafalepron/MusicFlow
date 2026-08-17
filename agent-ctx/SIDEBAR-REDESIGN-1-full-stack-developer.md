---
Task ID: SIDEBAR-REDESIGN-1
Agent: full-stack-developer
Task: Redesign left sidebar (remove nav sections + add artist profile card + project chat at bottom) and add Home button to header

Work Log:
- Read /home/z/my-project/worklog.md and the previous agent's record (HOME-REDESIGN-main.md) to understand the cyberpunk visual language already established (YELLOW=#c7a008, CYAN=#00a8c6, PURPLE=#7b2cbf, BTN_CLIP/CARD_CLIP angular clip-paths, hexToRgba helper).
- Read all the key files: src/components/layout/app-sidebar.tsx, src/components/layout/app-header.tsx (1296 lines), src/app/page.tsx, src/lib/store.ts, src/store/chat-context-store.ts, src/store/chat-ui-store.ts, src/components/chat/project-chat.tsx, prisma/schema.prisma, src/app/api/groups/route.ts, src/app/api/groups/[id]/route.ts, src/app/api/auth/login/route.ts.
- Verified the data shapes: Group has {id,name,description,avatarUrl,genre,inviteCode,ownerId}, Project has {id,groupId,title,type,coverUrl,status,kanbanTaskId,createdAt,updatedAt}. Confirmed useChatContextStore exposes {activeChatProjectId, activeChatProjectName, setActiveChatProject(id, name)} and useChatUIStore exposes {isOpen, open, close, toggle}.
- Confirmed ProjectChat renders as a `position: fixed right-0 top-0 bottom-0 z-50` floating slide-in panel driven by `useChatUIStore.isOpen && useChatContextStore.activeChatProjectId`. This meant: (1) it should be rendered OUTSIDE any `transform`-affected ancestor (else the fixed positioning breaks), and (2) the sidebar's chat section uses a project selector + "open chat" button approach because ProjectChat itself can't be made inline without rewriting it (off-limits per "do not break existing functionality").

Files Created/Modified:

1. Created `src/store/sidebar-store.ts` (29 lines) — Zustand store with persist middleware. State: isCollapsed (desktop retract), isMobileOpen (mobile drawer). Actions: toggle/setCollapsed/setMobileOpen/toggleMobile. Persisted under key `soundflow-sidebar`.

2. Modified `src/app/api/groups/route.ts` — added GET handler accepting `?userId=<userId>`, returns all groups the user is a member of (with member + project counts and membership info).

3. Modified `src/app/api/groups/[id]/route.ts` — added PATCH handler with zod validation for {name, description, genre, avatarUrl} (all optional/nullable). Used by the sidebar's EditableDescription to save group description changes.

4. Modified `src/app/globals.css` — added `.custom-scrollbar` styles (6px wide, cyan-tinted track + thumb with hover effect) for the sidebar's scrollable sections.

5. Rewrote `src/components/layout/app-sidebar.tsx` (~1080 lines):
   - REMOVED navItems array, NavItem component, group info card, user section, scrollable nav, tooltip imports.
   - ADDED ArtistProfileCard (top): large 64×64 group avatar (AVATAR_CLIP angular frame, yellow glow) → group name (bold uppercase yellow) → genre (cyan, Disc3 icon) → InviteCodeRow (monospace BTN_CLIP code + Copy button) → EditableDescription (click-to-edit textarea, PATCH /api/groups/[id], ⌘/Ctrl+Enter to save, Esc to cancel, 500-char limit with live counter) → GroupSwitcher (only when userGroups.length > 1, [<] [N/M] [>] arrows in BTN_CLIP) → Performance info section (PURPLE-themed "Показатели", 4-cell stats grid: members/projects/tracks/ideas + "Создан:" date row) → Linked projects section (filters projects by groupId, each is a clickable BTN_CLIP button navigating to project-detail).
   - Fetches user's groups via /api/groups?userId={userId} for the switcher, and member count via /api/groups/{id}/members.
   - ADDED SidebarChatSection (bottom): MessageCircle header + "ЧАТ ПРОЕКТА" label → Popover-based project selector dropdown → placeholder "Выберите проект для чата" when no project selected (per spec, in Russian) → "Открыть чат" / "Чат открыт — скрыть" toggle button (YELLOW when closed, CYAN when open) → calls setActiveChatProject(kanbanTaskId||projectId, title) + useChatUIStore.open() on project select.
   - ADDED AppSidebar export: sliding <aside> with `transition-transform duration-300` driven by isMobileOpen (mobile) and isCollapsed (desktop via lg: prefix). Mobile backdrop overlay (bg-black/50, lg:hidden) tap-to-close. Floating expand toggle (top-3 left-3, BTN_CLIP, yellow glow, ChevronRight icon, AnimatePresence fade/scale). Floating collapse toggle (top-3 left-[228px], cyan glow, ChevronsLeft icon). <ProjectChat/> rendered in the fragment root (OUTSIDE the transform-affected aside) so its fixed positioning stays viewport-relative.
   - Toggle handler picks the right store based on `window.innerWidth < 1024`.

6. Modified `src/components/layout/app-header.tsx` (~1170 lines):
   - REMOVED Sheet-based mobile nav (SheetContent + MobileNavContent function, ~110 lines), navItems array, chat toggle button JSX (~50 lines), MessageCircle/useChatContextStore/useChatUIStore/useChatUnread imports, unused User/Separator/Sheet imports.
   - ADDED useSidebarStore import.
   - ADDED Home button (cyberpunk HUD style) immediately after the hamburger menu. 36×36 BTN_CLIP-shaped button: muted-foreground icon on dark #12151d with #232a3b border by default; YELLOW icon + border + 10px outer glow + 8px inner glow + top-left corner accent notch (1.5×1.5px yellow square with glow) when currentView === 'home'. Hover: yellow border + 8px glow. Tooltip "На главную". Calls navigate('home') via handleHomeClick.
   - MODIFIED hamburger menu: was Sheet trigger, now directly calls useSidebarStore.toggleMobile(). Styled with cyan tint when active (isMobileSidebarOpen), cyan border + glow when active. Tooltip "Меню".

7. Modified `src/app/page.tsx`:
   - Removed global <ProjectChat/> render (now lives inside <AppSidebar/>).
   - Added useSidebarStore import.
   - AppContent reads isSidebarCollapsed and applies dynamic padding: main content wrapper `lg:pl-60`/`lg:pl-0` with `transition-[padding] duration-300 ease-out`; footer `lg:ml-60`/`lg:ml-0` with `transition-[margin] duration-300 ease-out`.

Verification:
- `bun run lint 2>&1 | grep -E "app-sidebar|app-header|page\.tsx|sidebar-store|groups"` → only ONE error: app-header.tsx:227 (pre-existing `react-hooks/set-state-in-effect` in the search useEffect, present in baseline before my changes — verified via git stash). My changes introduced zero new lint errors.
- `npx tsc --noEmit --skipLibCheck 2>&1 | grep -E "app-sidebar|app-header|page\.tsx|sidebar-store|groups"` → empty (no TypeScript errors in modified files).
- Dev server log (/home/z/my-project/dev.log) confirms:
  * `GET /api/groups?userId=cmsx9pq880000wpvj3dss898z 200` — new endpoint works
  * `GET /api/groups/cmsx9pxvl0002wpvj7ygpd8ft/members 200` — sidebar fetching member count
  * `GET /api/groups/cmsx9pxvl0002wpvj7ygpd8ft 200` — sidebar fetching current group info
  * All existing API calls (notifications, tasks, projects, ideas) return 200
  * `GET / 200` — page renders successfully
  * `✓ Compiled in XXXms` — no compile errors

Stage Summary:
- Sidebar is now retractable via floating ChevronRight (expand) / ChevronsLeft (collapse) toggle buttons. State persists in localStorage.
- Sidebar shows artist profile card with avatar, name, genre, invite code, editable description (click-to-edit + PATCH API), performance stats, group switcher arrows (when multiple groups), and linked projects list.
- Sidebar shows project chat at bottom: dropdown to pick project, "Выберите проект для чата" placeholder when none selected, "Открыть чат" toggle button. <ProjectChat/> embedded so the floating panel works from any view.
- Header has cyberpunk Home button (YELLOW active state + corner notch) calling navigate('home'). Placed right after the hamburger menu.
- Header hamburger menu now toggles the sidebar drawer (no longer opens a Sheet with nav items — nav items were removed per spec).
- Header chat toggle button removed (chat moved to sidebar).
- Main content + footer dynamically shift between lg:pl-60/lg:ml-60 (expanded) and lg:pl-0/lg:ml-0 (collapsed) with smooth 300ms transition.
- All existing functionality preserved: purple stripe quick-access panel, track detail view, kanban view, project detail view, notifications, profile dropdown, search.
