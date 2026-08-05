import { create } from 'zustand';

interface ChatContextState {
  // The kanban task ID that the global chat should scope to.
  // This is determined by the current view context:
  // - In kanban view: the selected kanban project task ID
  // - In project-detail/track-detail: the project's kanbanTaskId
  activeChatProjectId: string | null;
  // Display name for the chat header
  activeChatProjectName: string | null;

  setActiveChatProject: (projectId: string | null, projectName?: string | null) => void;
}

export const useChatContextStore = create<ChatContextState>((set) => ({
  activeChatProjectId: null,
  activeChatProjectName: null,

  setActiveChatProject: (projectId, projectName) =>
    set({
      activeChatProjectId: projectId,
      activeChatProjectName: projectName ?? null,
    }),
}));
