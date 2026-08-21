import type { Project, Track } from '@/lib/store';
import type { Task } from '@/store/kanban-store';

/**
 * Shared progress calculation for projects.
 *
 * Used by:
 *  - HomeView ProjectCard (auto projects)
 *  - HomeView KanbanCard (kanban projects)
 *  - HomeView QuickAccessCard (favorites)
 *  - AppHeader quick-access panel cards
 *
 * Logic:
 *  - Auto projects (have a SoundFlow Project record): based on track count
 *    (each track ~12%, capped at 80%) + status boost (released=100,
 *    mastering=90, mixing=70, in_progress=40). Takes the max.
 *  - Kanban-only projects (Task with no SoundFlow project link): based on
 *    done/total child tasks ratio (0-100%).
 *
 * This ensures the SAME project shows the SAME progress everywhere.
 */

// Status boost map — how much progress a status implies on its own.
const STATUS_BOOST: Record<string, number> = {
  released: 100,
  mastering: 90,
  mixing: 70,
  in_progress: 40,
  // Track statuses (don't affect project progress directly, but kept for safety)
  ready: 100,
  review: 70,
  waiting: 0,
};

/**
 * Compute progress (0-100) for an auto project (one with a SoundFlow Project
 * record, possibly linked to a kanban task).
 */
export function getAutoProjectProgress(
  project: Pick<Project, 'status'>,
  trackCount: number
): number {
  const trackPct = Math.min(80, trackCount * 12); // each track ~12%, capped at 80
  const statusBoost = STATUS_BOOST[project.status] ?? 0;
  return Math.max(trackPct, statusBoost);
}

/**
 * Compute progress (0-100) for a kanban-only project (a Task with children,
 * not linked to a SoundFlow Project).
 */
export function getKanbanProjectProgress(task: Task): number {
  const children = task.children || [];
  if (children.length === 0) return 0;
  const done = children.filter((c) => c.status === 'done').length;
  return Math.round((done / children.length) * 100);
}

/**
 * Compute progress (0-100) for a unified card — works for both auto and kanban
 * projects. Uses the appropriate calculation based on whether it's an auto
 * project or a kanban-only task.
 *
 * @param isAuto - true if this is an auto project (has a SoundFlow Project)
 * @param status - project status (for auto projects)
 * @param trackCount - number of tracks (for auto projects)
 * @param kanbanTask - the kanban task (for kanban-only projects, to compute
 *   done/total children ratio)
 */
export function getUnifiedProgress(
  isAuto: boolean,
  status: string,
  trackCount: number,
  kanbanTask?: Task | null
): number {
  if (isAuto) {
    return getAutoProjectProgress({ status }, trackCount);
  }
  if (kanbanTask) {
    return getKanbanProjectProgress(kanbanTask);
  }
  return 0;
}
