---
Task ID: CLOSE-CONFIRM
Agent: full-stack-developer
Task: Add confirmation dialog when closing/completing a stage or task with unclosed subtasks/children

Work Log:
- Read /home/z/my-project/worklog.md to load project context (kanban cyberpunk UI, TaskChild/TaskGrandchild/Task hierarchy, board color theming pattern with `c = useMemo(...)` from `hexToRgba(boardColor, ...)`).
- Read /home/z/my-project/src/store/kanban-store.ts (lines 1-90) to verify types:
  * TaskStatus = 'todo' | 'in-progress' | 'review' | 'done'
  * Task.children: TaskChild[]
  * TaskChild.children?: TaskGrandchild[]  (stages → subtasks, 2 levels deep from top Task)
- Read /home/z/my-project/src/components/kanban/description-bottom-panel.tsx StageCard (lines 581-901 originally): `subtasks = stage.children || []`, `cycleStatus` cycles ['todo','in-progress','done'] directly via onUpdate({status}), SubtasksList receives `updateSubtask(subId, patch, reloadTasks)` and StageCard has direct `reloadTasks` prop.
- Read /home/z/my-project/src/components/board/task-strip.tsx (544 lines): TaskStrip's cycleStatus takes (e, task), order=['todo','in-progress','review','done'], PUTs to /api/tasks then calls reloadTasks(); the panel uses fixed positioning but the kanban board likely has transform-based panning, so I used createPortal to document.body to avoid `position: fixed` being trapped inside a transformed ancestor.

EDITS to /home/z/my-project/src/components/kanban/description-bottom-panel.tsx:
- Added `import { createPortal } from 'react-dom';` after the React useState import.
- StageCard (around line 602): added two new state vars `const [showCloseConfirm, setShowCloseConfirm] = useState(false)` and `const [closingAll, setClosingAll] = useState(false)`. Added `const unclosedSubtasks = subtasks.filter(s => s.status !== 'done')`.
- Modified `cycleStatus` so that when `next === 'done' && unclosedSubtasks.length > 0`, it calls `setShowCloseConfirm(true)` and returns early instead of calling onUpdate. Otherwise falls through to the original `await onUpdate({ status: next })`.
- Added `completeAllAndClose` async fn: iterates subtasks, PUTs status='done' for any with status !== 'done' (via direct /api/tasks fetch), then calls `await onUpdate({ status: 'done' })` and `await reloadTasks()`. Wrapped in try/finally to clear `closingAll` and `showCloseConfirm`.
- Inserted the confirmation dialog JSX right before the closing `</div>` of the cp-stage-card root, conditionally rendered via `{showCloseConfirm && typeof document !== 'undefined' && createPortal(<dialog/>, document.body)}`:
  * Outer overlay: `fixed inset-0 z-[200] flex items-center justify-center`, background rgba(0,0,0,0.7) + backdrop blur(4px), onClick closes (disabled while closingAll).
  * Inner panel: background rgba(8,10,18,0.98), border `1.5px solid ${c.a4}` (board color accent), angular clip-path corners, boxShadow with `${c.a15}` glow + yellow tint + drop shadow, padding 20px, maxWidth 400px.
  * Header: AlertTriangle icon in a yellow-tinted rounded square + title "Этап не завершён" + stage title in quotes.
  * Body: "Остались незавершённые подзадачи (N). Завершить все подзадачи вместе с этапом?"
  * List: max-h-40 overflow-y-auto scrollable, each item shows a colored status dot (orange for in-progress, cyan for todo) + title + status label.
  * Buttons: "Отмена" (gray, flex-1) and "Завершить все" (yellow #FCEE0A, flex-1, with Check icon, clip-path corners, glow). While closingAll shows a spinner + "Завершение...".
- SubtaskRow: untouched per spec (subtasks have no children → no confirmation needed).

EDITS to /home/z/my-project/src/components/board/task-strip.tsx:
- Added `import { createPortal } from 'react-dom';` after the React import.
- Added two state vars in TaskStrip component: `const [closeConfirmTask, setCloseConfirmTask] = useState<Task | null>(null)` and `const [closingAllTask, setClosingAllTask] = useState(false)`.
- Modified `cycleStatus(e, task)`: when `next === 'done'`, calls `collectUnclosedDescendants(task)` and if it returns >0 items, calls `setCloseConfirmTask(task)` and returns early. Otherwise falls through to the original PUT + reloadTasks.
- Added `collectUnclosedDescendants(task)` helper: walks `task.children` recursively (stages → subtasks), returning `Array<{id, title, status, level}>` for every descendant whose status !== 'done'. The `level` is used for visual indentation in the list.
- Added `closeAllDescendants(taskId, children)` async helper: recursively iterates children, PUTs status='done' for any whose status !== 'done', then recurses into `child.children`.
- Added `completeAllAndCloseTask(task)` async fn: calls `closeAllDescendants`, then PUTs the task itself to status='done', then calls `reloadTasks()`. Wrapped in try/finally to clear closingAllTask and closeConfirmTask.
- Inserted the confirmation dialog JSX right before the closing `</div>` of the ts-panel root (after the scrollable tasks list), conditionally rendered via `{closeConfirmTask && typeof document !== 'undefined' && createPortal((() => { ... })(), document.body)}`:
  * Same cyberpunk styling pattern as StageCard (dark bg, board-color border, angular clip-path, yellow glow).
  * Header: AlertTriangle + "Задача не завершена" + task title in quotes.
  * Body: "Остались незавершённые этапы и подзадачи (N). Завершить все вместе с задачей?"
  * List: max-h-48 scrollable, items indented by level (`paddingLeft: 10 + level*12 px`), colored status dot, status label (в работе / ревью / к вып.).
  * Buttons: "Отмена" (gray) and "Завершить все" (yellow, Check icon). Spinner shown while closingAllTask.

VERIFICATION:
- Ran `cd /home/z/my-project && bun run lint 2>&1 | grep -E "description-bottom-panel|task-strip"` → no output (clean).
- Full `bun run lint` → 2 errors, both PRE-EXISTING in /home/z/my-project/src/components/layout/app-header.tsx (react-hooks/set-state-in-effect, lines 132 & ~140 — unrelated to this task). 0 warnings.
- Checked /home/z/my-project/dev.log: shows `✓ Compiled in 171ms` and `✓ Compiled in 454ms` after edits with no errors related to description-bottom-panel.tsx or task-strip.tsx.

Stage Summary:
- Closing a STAGE (clicking its status icon when next would be 'done') now intercepts: if any subtask has status !== 'done', a portal-rendered cyberpunk dialog appears listing all unclosed subtasks by name with status dots, offering "Завершить все" (marks all subtasks + stage done via PUT /api/tasks) or "Отмена" (no-op). If all subtasks are already done, the cycle proceeds silently.
- Closing a TOP TASK in task-strip.tsx works the same way but recursively: it collects ALL unclosed descendants at every level (stages AND their subtasks) for display, and "Завершить все" recursively marks every unclosed descendant + the task itself as done.
- Both dialogs use createPortal(…, document.body) so `position: fixed` is anchored to the viewport, NOT trapped inside any transformed/panning ancestor — this guarantees the dialog won't interfere with the existing board panning/clicking behavior.
- Styling matches existing cyberpunk theme: dark bg rgba(8,10,18,0.98), board-color border (c.a4), angular clip-path corners, yellow (#FCEE0A) accent for the "Завершить все" button, AlertTriangle warning icon, all text in Russian.
- Lint clean for both modified files; dev server compiles cleanly.
