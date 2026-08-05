import { create } from 'zustand';

interface AudioContextState {
  // The currently active audio track ID (from SoundFlow Track model)
  activeTrackId: string | null;
  // The project ID (SoundFlow Project) of the active track
  activeProjectId: string | null;
  // The kanban task ID wrapping the active project (for chat scoping)
  activeKanbanTaskId: string | null;
  // Current playhead position in seconds
  currentTime: number;
  // Whether audio is currently playing
  isPlaying: boolean;

  setActiveTrack: (trackId: string | null, projectId: string | null, kanbanTaskId: string | null) => void;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
}

export const useAudioContextStore = create<AudioContextState>((set) => ({
  activeTrackId: null,
  activeProjectId: null,
  activeKanbanTaskId: null,
  currentTime: 0,
  isPlaying: false,

  setActiveTrack: (trackId, projectId, kanbanTaskId) =>
    set({
      activeTrackId: trackId,
      activeProjectId: projectId,
      activeKanbanTaskId: kanbanTaskId,
    }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
}));
