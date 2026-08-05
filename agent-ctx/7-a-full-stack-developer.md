# Task 7-a — Remove chat panel from TrackDetailView, add Open-in-Kanban button, wire audio context store

## Files modified
- `/home/z/my-project/src/components/views/track-detail-view.tsx` (3246 → 2887 lines)

## What was removed
- `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle` imports + the entire right-side chat panel.
- `ChatMessage` type import, `normalizeMessage()` helper, `renderChatText()` function.
- Chat state: `chatMessages, chatInput, chatLinkedTimestamp, chatLinkedCommentId, pendingVersionSwitch, chatEndRef, chatScrollRef`, `addMessage` hook.
- Chat fetch useEffect, chat auto-scroll useEffect, `handleSendMessage` callback, `shareCommentToChat` callback.
- `socket.on('message:new', ...)` listener + `addMessage` from WebSocket useEffect deps.
- The `pendingVersionSwitch` Dialog block.
- Both "Send" share-to-chat buttons (in marker tooltip and comment card).
- `Clock` and `ArrowLeftRight` lucide-react imports (only used by removed chat UI).
- `// --- Chat ---` comment block.

## What was added
- `import { useKanbanStore } from '@/store/kanban-store';`
- `import { useAudioContextStore } from '@/store/audio-context-store';`
- `LayoutDashboard` to the lucide-react import list.
- Three audio-context-store sync useEffects after the existing volume-sync effect:
  - `setAudioContextTime(currentTime)` whenever `currentTime` changes.
  - `setAudioContextPlaying(isPlaying)` whenever `isPlaying` changes.
  - `setActiveTrack(selectedTrackId, selectedProjectId, projectOfTrack?.kanbanTaskId ?? null)` on mount/track-change, with cleanup that calls `setActiveTrack(null, null, null)` on unmount.
- "Open in Kanban" button in the track header (between the title/ideas strip and the status dropdown):
  - Uses `useDataStore.getState().projects.find(p => p.id === selectedProjectId)` to read the project.
  - If `project.kanbanTaskId` exists → `useNavigationStore.getState().navigate('kanban')` then `setTimeout(() => useKanbanStore.getState().selectProject(project.kanbanTaskId), 300)`.
  - `disabled={!projectOfTrack?.kanbanTaskId}` — gracefully disabled for projects with no kanban link.
  - Tooltip adapts to enabled/disabled state.
- Compact participant presence row (avatars + "N online · M members" caption) inside the Comments Section header area, preserving the existing `groupMembers` / `onlineUserIds` state and the `presence:update` / `presence:current` socket listeners.

## What was kept
- Audio player (seek bar, controls, volume).
- Waveform canvas with comment markers, range markers, hover tooltip.
- Timestamped comments (post / edit / delete / resolve / reply).
- Versions strip + Add Version dialog + upload progress.
- Ideas Stories Strip.
- Status dropdown.
- WebSocket `room:join`/`room:leave`, `presence:update`, `presence:current`, `comment:new`, `comment:updated`, `comment:deleted`, `track:update_status` events.

## Verification
- `bun run lint` → exit 0.
- `tail /home/z/my-project/dev.log` shows multiple `✓ Compiled in <ms>` after each edit batch with no errors attributed to track-detail-view.tsx.
- Pre-existing unrelated Prisma error about `kanbanTask` field on the `Project` include in `/api/projects/route.ts` was already present before this task (noted in task 5-a's worklog as out-of-scope) and is not caused by these changes.

## Canonical record
Full work log appended to `/home/z/my-project/worklog.md` under the `Task ID: 7-a` section.
