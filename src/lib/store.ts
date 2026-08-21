import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Types
export type ViewName = 
  | 'onboarding'
  | 'home'
  | 'ideas'
  | 'projects'
  | 'project-detail'
  | 'track-detail'
  | 'kanban'
  | 'group-settings';

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  genre?: string;
  inviteCode: string;
  ownerId: string;
}

export interface MemberInfo {
  role: string;
  instrument?: string;
  joinedAt: string;
}

export interface Project {
  id: string;
  groupId: string;
  folderId?: string | null;
  title: string;
  type: string;
  coverUrl?: string;
  status: string;
  kanbanTaskId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  id: string;
  groupId: string;
  title: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Idea {
  id: string;
  groupId: string;
  createdBy: string;
  title: string;
  description?: string;
  audioUrl?: string;
  waveformUrl?: string;
  durationMs?: number;
  tags?: string;
  projectId?: string;
  createdAt: string;
}

export interface Track {
  id: string;
  projectId: string;
  sourceIdeaId?: string;
  title: string;
  trackNumber?: number;
  audioUrl: string;
  waveformUrl?: string;
  durationMs?: number;
  coverUrl?: string;
  description?: string;
  genre?: string;
  status: string;
  version: number;
  createdBy: string;
  kanbanTaskId?: string | null;
  createdAt: string;
}

export interface Comment {
  id: string;
  trackId: string;
  versionId?: string;
  parentId?: string;
  userId: string;
  userName: string;
  timestampMs: number;
  rangeEndMs?: number;
  text: string;
  isResolved: boolean;
  createdAt: string;
}

export interface TrackVersion {
  id: string;
  trackId: string;
  version: number;
  label: string;
  audioUrl: string;
  durationMs?: number;
  createdBy: string;
  createdAt: string;
  commentCount?: number;
}

export interface ChatMessage {
  id: string;
  entityType: string;
  entityId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  entityId: string;
  projectId: string;
  title: string;
  body?: string;
  isRead: boolean;
  createdAt: string;
  projectName?: string;
}

// Navigation state
interface NavigationState {
  currentView: ViewName;
  selectedProjectId: string | null;
  selectedTrackId: string | null;
  navigate: (view: ViewName, projectId?: string, trackId?: string) => void;
}

// Auth state
interface AuthState {
  user: User | null;
  currentGroupId: string | null;
  currentGroupName: string | null;
  currentGroupInviteCode: string | null;
  memberInfo: MemberInfo | null;
  setUser: (user: User | null) => void;
  setCurrentGroupId: (groupId: string | null) => void;
  setCurrentGroupName: (name: string | null) => void;
  setCurrentGroupInviteCode: (code: string | null) => void;
  setMemberInfo: (info: MemberInfo | null) => void;
  logout: () => void;
}

// Data state
interface DataState {
  groups: Group[];
  currentGroup: Group | null;
  projects: Project[];
  folders: Folder[];
  ideas: Idea[];
  tracks: Track[];
  comments: Comment[];
  versions: TrackVersion[];
  messages: ChatMessage[];
  notifications: Notification[];
  notificationCount: number;
  setGroups: (groups: Group[]) => void;
  setCurrentGroup: (group: Group | null) => void;
  setProjects: (projects: Project[]) => void;
  setFolders: (folders: Folder[]) => void;
  setIdeas: (ideas: Idea[]) => void;
  setTracks: (tracks: Track[]) => void;
  setComments: (comments: Comment[]) => void;
  setVersions: (versions: TrackVersion[]) => void;
  setMessages: (messages: ChatMessage[]) => void;
  setNotifications: (notifications: Notification[]) => void;
  setNotificationCount: (count: number) => void;
  addComment: (comment: Comment) => void;
  updateComment: (id: string, updates: Partial<Comment>) => void;
  removeComment: (id: string) => void;
  addMessage: (message: ChatMessage) => void;
  removeIdea: (id: string) => void;
  addProject: (project: Project) => void;
  addFolder: (folder: Folder) => void;
  updateFolder: (id: string, updates: Partial<Folder>) => void;
  removeFolder: (id: string) => void;
  addIdea: (idea: Idea) => void;
  addTrack: (track: Track) => void;
  updateTrack: (id: string, updates: Partial<Track>) => void;
  updateTrackStatus: (id: string, status: string) => void;
  updateProjectFolder: (id: string, folderId: string | null) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  currentView: 'onboarding',
  selectedProjectId: null,
  selectedTrackId: null,
  navigate: (view, projectId, trackId) =>
    set({
      currentView: view,
      selectedProjectId: projectId || null,
      selectedTrackId: trackId || null,
    }),
}));

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      currentGroupId: null,
      currentGroupName: null,
      currentGroupInviteCode: null,
      memberInfo: null,
      setUser: (user) => set({ user }),
      setCurrentGroupId: (groupId) => set({ currentGroupId: groupId }),
      setCurrentGroupName: (name) => set({ currentGroupName: name }),
      setCurrentGroupInviteCode: (code) => set({ currentGroupInviteCode: code }),
      setMemberInfo: (info) => set({ memberInfo: info }),
      logout: () =>
        set({ user: null, currentGroupId: null, currentGroupName: null, currentGroupInviteCode: null, memberInfo: null }),
    }),
    { name: 'soundflow-auth' }
  )
);

export const useDataStore = create<DataState>((set) => ({
  groups: [],
  currentGroup: null,
  projects: [],
  folders: [],
  ideas: [],
  tracks: [],
  comments: [],
  versions: [],
  messages: [],
  notifications: [],
  notificationCount: 0,
  setGroups: (groups) => set({ groups }),
  setCurrentGroup: (group) => set({ currentGroup: group }),
  setProjects: (projects) => set({ projects }),
  setFolders: (folders) => set({ folders }),
  setIdeas: (ideas) => set({ ideas }),
  setTracks: (tracks) => set({ tracks }),
  setComments: (comments) => set({ comments }),
  setVersions: (versions) => set({ versions }),
  setMessages: (messages) => set({ messages }),
  setNotifications: (notifications) => set({ notifications }),
  setNotificationCount: (count) => set({ notificationCount: count }),
  addComment: (comment) =>
    set((state) => ({ comments: [...state.comments, comment] })),
  updateComment: (id, updates) =>
    set((state) => ({
      comments: state.comments.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),
  removeComment: (id) =>
    set((state) => ({ comments: state.comments.filter((c) => c.id !== id) })),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  removeIdea: (id) =>
    set((state) => ({ ideas: state.ideas.filter((i) => i.id !== id) })),
  addProject: (project) =>
    set((state) => ({ projects: [...state.projects, project] })),
  addFolder: (folder) =>
    set((state) => ({ folders: [...state.folders, folder] })),
  updateFolder: (id, updates) =>
    set((state) => ({
      folders: state.folders.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    })),
  removeFolder: (id) =>
    set((state) => ({ folders: state.folders.filter((f) => f.id !== id) })),
  addIdea: (idea) =>
    set((state) => ({ ideas: [...state.ideas, idea] })),
  addTrack: (track) =>
    set((state) => ({ tracks: [...state.tracks, track] })),
  updateTrack: (id, updates) =>
    set((state) => ({
      tracks: state.tracks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  updateTrackStatus: (id, status) =>
    set((state) => ({
      tracks: state.tracks.map((t) => (t.id === id ? { ...t, status } : t)),
    })),
  updateProjectFolder: (id, folderId) =>
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, folderId } : p)),
    })),
}));
