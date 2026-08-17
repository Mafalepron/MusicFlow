'use client';

import { useEffect, useCallback } from 'react';
import { useNavigationStore, useAuthStore, useDataStore, type Project } from '@/lib/store';
import { useKanbanStore } from '@/store/kanban-store';
import { useChatContextStore } from '@/store/chat-context-store';
import { useSidebarStore } from '@/store/sidebar-store';
import { AnimatePresence, motion } from 'framer-motion';

import { OnboardingView } from '@/components/views/onboarding-view';
import { HomeView } from '@/components/views/home-view';
import { IdeasView } from '@/components/views/ideas-view';
import { ProjectsView } from '@/components/views/projects-view';
import { ProjectDetailView } from '@/components/views/project-detail-view';
import { TrackDetailView } from '@/components/views/track-detail-view';
import { GroupSettingsView } from '@/components/views/group-settings-view';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
import { KanbanPage } from '@/components/kanban/kanban-view';

const viewTransition = {
  initial: { opacity: 0, x: 10 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -10 },
  transition: { duration: 0.2 },
};

function ChatContextSync() {
  const currentView = useNavigationStore((s) => s.currentView);
  const navSelectedProjectId = useNavigationStore((s) => s.selectedProjectId);
  const projects = useDataStore((s) => s.projects);
  const kanbanSelectedProjectId = useKanbanStore((s) => s.selectedProjectId);
  const kanbanProjects = useKanbanStore((s) => s.projects);
  const setActiveChatProject = useChatContextStore((s) => s.setActiveChatProject);

  useEffect(() => {
    let chatProjectId: string | null = null;
    let chatProjectName: string | null = null;

    if (currentView === 'kanban' && kanbanSelectedProjectId) {
      // In kanban view: use the selected kanban project task ID
      chatProjectId = kanbanSelectedProjectId;
      const kp = kanbanProjects.find(p => p.id === kanbanSelectedProjectId);
      chatProjectName = kp?.title || null;
    } else if (currentView === 'project-detail' || currentView === 'track-detail') {
      // In project/track detail: use the SoundFlow project's kanbanTaskId
      if (navSelectedProjectId) {
        const project = projects.find(p => p.id === navSelectedProjectId);
        if (project?.kanbanTaskId) {
          chatProjectId = project.kanbanTaskId;
          chatProjectName = project.title;
        }
      }
    }

    // Only update if we have a new context; preserve last context on non-project views
    if (chatProjectId) {
      const current = useChatContextStore.getState();
      if (current.activeChatProjectId !== chatProjectId || current.activeChatProjectName !== chatProjectName) {
        setActiveChatProject(chatProjectId, chatProjectName);
      }
    }
  }, [currentView, navSelectedProjectId, kanbanSelectedProjectId, projects, kanbanProjects, setActiveChatProject]);

  return null;
}

function AppContent() {
  const currentView = useNavigationStore((s) => s.currentView);
  const navigate = useNavigationStore((s) => s.navigate);
  const user = useAuthStore((s) => s.user);
  const currentGroupId = useAuthStore((s) => s.currentGroupId);
  const isSidebarCollapsed = useSidebarStore((s) => s.isCollapsed);

  // Redirect to home if logged in but on onboarding view (e.g. after page reload)
  useEffect(() => {
    if (user && currentGroupId && currentView === 'onboarding') {
      navigate('home');
    }
  }, [user, currentGroupId, currentView, navigate]);

  // If no user, show onboarding
  if (!user || !currentGroupId) {
    return <OnboardingView />;
  }

  // Don't render content until navigation is resolved
  const activeView = currentView === 'onboarding' ? 'home' : currentView;

  // Main app layout with sidebar + unified header + content.
  // The sidebar is `position: fixed` so the main content needs left padding
  // on desktop — `lg:pl-60` when the sidebar is expanded, `lg:pl-0` when it
  // is collapsed (retracted).
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />

      {/* Main content area — offset for sidebar on desktop */}
      <div className={`${isSidebarCollapsed ? 'lg:pl-0' : 'lg:pl-60'} flex min-h-screen flex-col transition-[padding] duration-300 ease-out`}>
        <AppHeader />

        <main className="flex-1 p-4 lg:p-6">
          <AnimatePresence mode="wait">
            <motion.div key={activeView} {...viewTransition}>
              {activeView === 'home' && <HomeView />}
              {activeView === 'ideas' && <IdeasView />}
              {activeView === 'projects' && <ProjectsView />}
              {activeView === 'project-detail' && <ProjectDetailView />}
              {activeView === 'track-detail' && <TrackDetailView />}
              {activeView === 'kanban' && <KanbanPage />}
              {activeView === 'group-settings' && <GroupSettingsView />}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Sticky Footer — margin matches sidebar width so the footer
            aligns with the main content above it. */}
        <footer className={`border-t border-border bg-card/50 backdrop-blur-sm px-4 py-3 lg:px-6 ${isSidebarCollapsed ? 'lg:ml-0' : 'lg:ml-60'} transition-[margin] duration-300 ease-out`}>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>SoundFlow v1.0 MVP</span>
            <span>Built for musicians, by musicians</span>
          </div>
        </footer>
      </div>

      {/* Syncs the active chat project whenever the navigation context changes.
          The ProjectChat floating panel itself is rendered inside <AppSidebar/>
          so it's available on every view. */}
      <ChatContextSync />
    </div>
  );
}

export default function Home() {
  const user = useAuthStore((s) => s.user);
  const currentGroupId = useAuthStore((s) => s.currentGroupId);
  const setProjects = useDataStore((s) => s.setProjects);
  const setIdeas = useDataStore((s) => s.setIdeas);
  const setTracks = useDataStore((s) => s.setTracks);
  const setCurrentGroup = useDataStore((s) => s.setCurrentGroup);

  // Load data when user has a group
  const loadGroupData = useCallback(async () => {
    if (!currentGroupId) return;

    try {
      // Verify the group actually exists (handles stale persisted state)
      const groupRes = await fetch(`/api/groups/${currentGroupId}`);
      if (!groupRes.ok) {
        // Group doesn't exist — re-fetch user's actual membership via login
        const user = useAuthStore.getState().user;
        const nav = useNavigationStore.getState().navigate;
        if (user) {
          // Try to re-login to get the correct groupId
          try {
            // We don't have the password, so just clear stale state and redirect to onboarding
            const logout = useAuthStore.getState().logout;
            logout();
          } catch {
            // fallback: just redirect
          }
        }
        nav('onboarding');
        return;
      }

      // Sync fresh group data from server
      const groupData = await groupRes.json();
      const auth = useAuthStore.getState();
      auth.setCurrentGroupName(groupData.name);
      auth.setCurrentGroupInviteCode(groupData.inviteCode);
      setCurrentGroup(groupData);

      // Fetch projects and ideas in parallel
      const [projectsRes, ideasRes] = await Promise.all([
        fetch(`/api/projects?groupId=${currentGroupId}`),
        fetch(`/api/ideas?groupId=${currentGroupId}`),
      ]);

      let projectList: Project[] = [];
      if (projectsRes.ok) {
        projectList = await projectsRes.json();
        setProjects(projectList);
      }

      if (ideasRes.ok) {
        const ideas = await ideasRes.json();
        setIdeas(ideas);
      }

      // Fetch tracks for all projects (in parallel)
      const trackPromises = projectList.map(async (p: { id: string }) => {
        const trackRes = await fetch(`/api/projects/${p.id}/tracks`);
        if (trackRes.ok) return await trackRes.json();
        return [];
      });
      const trackResults = await Promise.all(trackPromises);
      const allTracks = trackResults.flat();
      setTracks(allTracks);
    } catch (err) {
      console.error('Failed to load group data:', err);
    }
  }, [currentGroupId, setProjects, setIdeas, setTracks, setCurrentGroup]);

  useEffect(() => {
    if (user && currentGroupId) {
      loadGroupData();
    }
  }, [user, currentGroupId, loadGroupData]);

  return <AppContent />;
}
