# TASKS-4-8-TRACK — Track-detail / audio-form view changes

Agent: main (Z.ai Code)
Files touched:
- src/components/views/track-detail-view.tsx (4127 → 4336 lines)
- src/components/waveform-progress-bar.tsx (109 → 109 lines, fully rewritten)
- src/lib/store.ts (added `updateTrack` action)
- src/app/api/tracks/[id]/route.ts (extended PATCH with coverUrl/description/genre)

## Task 8 — Fix AddVersionDialog sliding off-screen
- Single-line fix at the `<DialogContent>` className inside `AddVersionDialog` (around line 3942 of the original file).
- Removed the `relative` token from `className="relative border-0 rounded-none sm:max-w-md"` so the base `fixed top-[50%] left-[50%] translate-[-50%] translate-y-[-50%]` from `src/components/ui/dialog.tsx` (line 63) is preserved by twMerge.
- Result: dialog now stays centered on-screen instead of sliding into in-flow position.
- The inline `style` with the chamfered `clipPath` HUD look is preserved.

## Task 6 — New track status indicator set
- Replaced the contents of three constants (originally lines 291–327):
  - `statusDotColors` — only `waiting` (#9ca3af gray), `in_progress` (#3b82f6 blue), `review` (#f59e0b orange), `ready` (#10b981 green).
  - `statusLabels` — Russian labels: "Ожидает", "В работе", "На проверке", "Готов".
  - `STATUS_OPTIONS` — `['waiting', 'in_progress', 'review', 'ready']`.
- The existing `<Select>` dropdown (around lines 1753–1818) automatically picks up the new options because it iterates `STATUS_OPTIONS.map(...)` and reads colors/labels from the lookup tables — no JSX changes needed there.
- Matches the schema's new `status String @default("waiting")` on the Track model.

## Task 7 — Solid waveform progress bar + remove percentage readout
### waveform-progress-bar.tsx (full rewrite, 109 lines)
- Removed the individual equalizer bars + `kb5-eq-bounce` animation logic.
- New solid-fill design:
  - Outer container with `border: 1px solid ${hexToRgba(accentColor, 0.45)}` — the stroke/outline around the unfilled scale.
  - Solid filled portion (width = `pct%`) using `linear-gradient(to right, rgba(accentColor,0.85), accentColor)` + neon glow box-shadow.
  - HUD scanlines in the unfilled portion (right side, width = `100 - pct%`) using a `repeating-linear-gradient` of the accent color.
  - Subtle horizontal center axis line for the recessed-track feel.
  - White playhead line at the fill boundary (2px wide, neon glow).
  - Playhead sweep animation preserved on hover (uses existing `kb5-playhead-sweep` keyframe + `--kb5-progress` CSS var).
- Kept the `progress`, `accentColor`, `height`, `bars` props (bars is now ignored — kept for backward compatibility with the 5 existing call sites in `app-header.tsx`, `home-view.tsx`, `track-detail-view.tsx`).

### track-detail-view.tsx
- Removed the "Big percentage readout" `<div>` that displayed `projectProgress.pct` as a huge gold number + "%" sign in the Project progress sub-panel (was around lines 2003–2019 of the original file, just below the `projectProgress ?` branch).
- The mini project progress bar + compact stats grid below it are preserved.

## Task 5 — "Открыть в Канбане" link button in track progress panel
- Added a new cyan-outlined chamfered button in the "Прогресс трека" section title row (right-aligned via `ml-auto`).
- Only renders when `projectOfTrack?.kanbanTaskId` is truthy (same condition as the existing header action).
- On click: looks up the project via `useDataStore.getState().projects.find(...)`, calls `useNavigationStore.getState().navigate('kanban')`, then 300ms later calls `useKanbanStore.getState().selectProject(taskId)` — same pattern as the existing header action at lines 967-987 of the original file.
- Styled to match the cyberpunk HUD aesthetic: dark `BG_PANEL` background, cyan border, `CHAMFER_4` clipPath, JetBrains Mono uppercase text, inset bevel shadow, hover `-translate-y-0.5` lift, LayoutDashboard icon with cyan drop-shadow.

## Task 4 — Track profile section in the audio form
### Backend — extended PATCH /api/tracks/[id] route (src/app/api/tracks/[id]/route.ts)
- Added `coverUrl`, `description`, `genre` to the destructured PATCH body.
- Each field is handled with null/empty-string coercion: empty string → null (so the UI can "clear" a field by submitting "").
- All three fields are added to the `data` object only when explicitly provided (undefined = no change), matching the existing pattern for `title`/`status`/`audioUrl`.
- Verified end-to-end with curl: `PATCH /api/tracks/{id}` with `{"description":"...","genre":"Rock","coverUrl":"https://..."}` correctly persists all three fields; subsequent PATCH with `{"description":null,"genre":"","coverUrl":null}` correctly clears them.

### Backend — added `updateTrack` action to useDataStore (src/lib/store.ts)
- New action: `updateTrack: (id: string, updates: Partial<Track>) => void` — shallow-merges updates into the matching track in the `tracks` array.
- Used by the new track-profile UI to optimistically update the local cache after a successful PATCH.

### Frontend — track profile UI section (track-detail-view.tsx)
- Added ~110 lines of new state + handlers + JSX inside the `TrackDetailView` component, placed in the "Прогресс трека" panel between the section title row and the `WaveformProgressBar`.
- State:
  - `editingDesc`, `descDraft`, `savingDesc` — for the description textarea.
  - `editingGenre`, `genreDraft`, `savingGenre` — for the genre input.
  - `editingCover`, `coverDraft`, `savingCover` — for the cover URL input.
  - `coverImgError` — set to true when the `<img>` fails to load (so we show the placeholder Music2 icon instead).
- `useEffect` resets all editing state + drafts whenever `selectedTrackId` or the track's `description`/`genre`/`coverUrl` changes.
- Three save handlers (`saveDescription`, `saveGenre`, `saveCover`) all do `PATCH /api/tracks/{id}` with the appropriate field, then call `updateTrack()` to update the local cache, then close the editor + show a toast.
- UI layout (left → right):
  - **Cover image**: 64×64 rounded square frame (borderRadius 6px) with 1.5px gold border + gold glow box-shadow + dark inset shadow. Shows the `<img>` if `track.coverUrl` exists and loaded successfully; otherwise a Music2 placeholder icon. Below the cover: an "edit/add" button that toggles a small URL input (`<input type="url">`) with OK/Cancel actions.
  - **Genre row**: a small "ЖАНР" label + an inline-editable button/input. When not editing: shows the genre or italic "Добавить жанр…" prompt (dashed border). When editing: a text input with Enter to save / Esc to cancel.
  - **Description block**: a "ОПИСАНИЕ" label + a click-to-edit button/textarea. When not editing: shows the description or italic "Добавить описание трека…" prompt (dashed border). When editing: a 3-row textarea with Ctrl+Enter to save / Esc to cancel / onBlur to save. Help text below shows the keyboard shortcuts.
- All empty fields show a clear "Добавить …" prompt (per the task's "If no cover/description/genre, show a prompt to add them" requirement).
- Visual style: dark `BG_MAIN` background, cyan border, `CHAMFER_4` clipPath, inset bevel shadow — matches the rest of the track-detail HUD.
- All inline-edit inputs use the existing cyberpunk typography (JetBrains Mono for labels, Rajdhani for body text).

## Verification
- `cd /home/z/my-project && bun run lint 2>&1 | grep -E "track-detail|waveform|store\.ts|tracks/\[id\]"` → ZERO errors/warnings in any of the touched files.
- `cd /home/z/my-project && bun run lint 2>&1 | grep -E "^/home/z/my-project" | sort -u` → only pre-existing errors remain (project-chat.tsx:654 set-state-in-effect, app-header.tsx:238 set-state-in-effect, home-view.tsx:1187/1245/1251 set-state-in-effect + memoization, use-favorites.ts:26 set-state-in-effect, db.ts unused eslint-disable warnings — all pre-existing, not introduced by this change).
- `tail -30 /home/z/my-project/dev.log` → server compiles cleanly. End-to-end PATCH test against `/api/tracks/cmsq1rhu50009uivf3mpqv1kx` returned 200 with the new fields correctly persisted (verified via Prisma query log: `UPDATE main.Track SET coverUrl = ?, description = ?, genre = ?, updatedAt = ? WHERE id = ?`).

## Note on dev server
- Mid-task I accidentally deleted `.next/dev/server` while debugging an unrelated Prisma `<dynamic>` module warning, which broke the running dev server (build-manifest.json missing). I restarted the dev server in the background via `setsid bash -c 'bun run dev > /tmp/dev-restart.log 2>&1' &` so the auto-runner process is now PID 6540. The dev server is alive and compiling cleanly as of the end of this task.
