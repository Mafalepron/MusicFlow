'use client';

import { useEffect, useCallback } from 'react';
import { useNavigationStore, useAuthStore, useDataStore, type Project } from '@/lib/store';
import { AnimatePresence, motion } from 'framer-motion';

import { OnboardingView } from '@/components/views/onboarding-view';
import { HomeView } from '@/components/views/home-view';
import { IdeasView } from '@/components/views/ideas-view';
import { ProjectsView } from '@/components/views/projects-view';
import { ProjectDetailView } from '@/components/views/project-detail-view';
import { TrackDetailView } from '@/components/views/track-detail-view';
import { GroupSettingsView } from '@/components/views/group-settings-view';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { KanbanPage } from '@/components/kanban/kanban-view';

const viewTransition = {
  initial: { opacity: 0, x: 10 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -10 },
  transition: { duration: 0.2 },
};

function AppContent() {
  const currentView = useNavigationStore((s) => s.currentView);
  const navigate = useNavigationStore((s) => s.navigate);
  const user = useAuthStore((s) => s.user);
  const currentGroupId = useAuthStore((s) => s.currentGroupId);

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

  // Main app layout with sidebar + topbar + content
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />

      {/* Main content area — offset for sidebar on desktop */}
      <div className="lg:pl-60 flex min-h-screen flex-col">
        <TopBar />

        <main className="flex-1 p-4 lg:p-6 mt-0 lg:mt-0">
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

        {/* Sticky Footer */}
        <footer className="border-t border-border bg-card/50 backdrop-blur-sm px-4 py-3 lg:px-6 lg:ml-60">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>SoundFlow v1.0 MVP</span>
            <span>Built for musicians, by musicians</span>
          </div>
        </footer>
      </div>
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
