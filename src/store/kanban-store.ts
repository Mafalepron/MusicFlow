import { create } from 'zustand';

export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskCategory = 'rehearsal' | 'recording' | 'performance' | 'marketing' | 'social' | 'general';
export type ProjectType = 'general' | 'album' | 'single';
export type BoardType = 'general' | 'tracks';

export interface TaskGrandchild {
  id: string;
  title: string;
  description: string | null;
  status: string;
  isProject: boolean;
  deadline: string | null;
  category: string;
}

export interface TaskChild {
  id: string;
  title: string;
  description: string | null;
  status: string;
  isProject: boolean;
  deadline: string | null;
  category: string;
  soundflowTrackId: string | null;
  children?: TaskGrandchild[];
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string | null;
  category: TaskCategory;
  isProject: boolean;
  projectType: string;
  trackConfig: string | null;
  parentId: string | null;
  boardId: string | null;
  hexQ: number;
  hexR: number;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
  soundflowProjectId: string | null;
  soundflowTrackId: string | null;
  children: TaskChild[];
}

export interface Board {
  id: string;
  title: string;
  color: string;
  sortOrder: number;
  boardType: string;
  isGhost: boolean;
  projectId: string;
  tasks: { id: string; title: string; status: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface DescriptionEditorItem {
  id: string;
  title: string;
  description: string | null;
  parentId: string;
  parentTitle: string;
}

// --- Onboarding types & config ---

export interface GuideStep {
  title: string;
  description: string;
  actionText?: string;
  actionType?: 'open-wizard' | 'create-task';
}

export interface BoardOnboardingConfig {
  title: string;
  description: string;
  guideSteps: GuideStep[];
}

const TRACKS_GUIDE: GuideStep[] = [
  { title: 'Создайте первый трек', description: 'Нажмите кнопку ниже, чтобы открыть конструктор трека с выбором инструментов и этапов', actionText: 'Открыть конструктор трека', actionType: 'open-wizard' },
  { title: 'Название трека', description: 'Введите название — это будет имя трека в проекте. Затем нажмите «Далее» в визарде' },
  { title: 'Выберите инструменты', description: 'Добавьте инструменты, которые участвуют в записи. От выбора зависят подзадачи этапа «Запись»' },
  { title: 'Этапы производства', description: 'Настройте этапы: от написания до мастеринга. Используйте шаблоны или создайте свои' },
];

const TASK_GUIDE: (title: string, desc: string) => GuideStep[] =
  (title, desc) => [
    { title, description: desc, actionText: 'Добавить задачу', actionType: 'create-task' },
    { title: 'Детали задачи', description: 'Укажите название, приоритет, категорию и дедлайн. Добавьте описание при необходимости' },
  ];

export const BOARD_ONBOARDING: Record<string, BoardOnboardingConfig> = {
  'Треки': { title: 'Доска «Треки»', description: 'Управление треками альбома с конструктором инструментов и этапов', guideSteps: TRACKS_GUIDE },
  'Трек': { title: 'Доска «Трек»', description: 'Конструктор вашего сингла с выбором инструментов и этапов', guideSteps: [
    { title: 'Начните конструировать трек', description: 'Нажмите кнопку ниже, чтобы открыть конструктор', actionText: 'Открыть конструктор трека', actionType: 'open-wizard' },
    { title: 'Название трека', description: 'Введите название сингла. Это имя будет отображаться на доске' },
    { title: 'Выберите инструменты', description: 'Добавьте инструменты для записи. Они определят структуру подзадач' },
    { title: 'Этапы производства', description: 'Настройте этапы производства. Можно использовать шаблоны или создать свои этапы' },
  ] },
  'Дизайн': { title: 'Доска «Дизайн»', description: 'Работа над обложкой, оформлением и визуальным стилем', guideSteps: TASK_GUIDE('Запланируйте визуальный стиль', 'Добавьте задачи: эскизы обложки, выбор фотографа, цветовая палитра. Разбейте работу на этапы с дедлайнами.') },
  'Дистрибуция': { title: 'Доска «Дистрибуция»', description: 'Планирование выпуска на стриминговых платформах', guideSteps: TASK_GUIDE('Подготовьте дистрибуцию', 'Добавьте задачи для каждой платформы: Spotify, Apple Music, Яндекс.Музыка и другие.') },
  'Маркетинг': { title: 'Доска «Маркетинг»', description: 'Стратегия продвижения и рекламных кампаний', guideSteps: TASK_GUIDE('Постройте стратегию продвижения', 'Создайте задачи: тизеры, пресс-релиз, сотрудничество с блогерами, рекламный бюджет.') },
  'Сведение': { title: 'Доска «Сведение»', description: 'Отслеживание процесса сведения всех треков', guideSteps: TASK_GUIDE('Начните сведение треков', 'Для каждого трека создайте задачу сведения с подзадачами.') },
  'Мастеринг': { title: 'Доска «Мастеринг»', description: 'Финальная подготовка и мастеринг аудио', guideSteps: TASK_GUIDE('Подготовьте мастеринг', 'Создайте задачи по мастерингу: финальная громкость, стерео-обработка.') },
  'Референсы': { title: 'Доска «Референсы»', description: 'Сбор вдохновения, референсов и идей', guideSteps: TASK_GUIDE('Собирайте вдохновение', 'Добавляйте задачи-референсы: треки-ориентиры, визуальные референсы, идеи.') },
  'Обложка': { title: 'Доска «Обложка»', description: 'Создание визуального оформления для сингла', guideSteps: TASK_GUIDE('Создайте обложку', 'Добавьте задачи: концепция, поиск художника, съёмка, ретушь, верстка.') },
  'Публикация': { title: 'Доска «Публикация»', description: 'Планирование выпуска на музыкальных платформах', guideSteps: TASK_GUIDE('Запланируйте релиз', 'Создайте задачи: загрузка на дистрибьютора, проверка мета-данных, дата релиза.') },
  'Продвижение': { title: 'Доска «Продвижение»', description: 'Продвижение в социальных сетях и медиа', guideSteps: TASK_GUIDE('Запустите продвижение', 'Добавьте задачи: посты, сторис, рекламные кампании, блогеры.') },
};

export type OnboardingPhase = 'create' | 'guide';

const DEFAULT_ONBOARDING = {
  active: false as boolean,
  currentIndex: 0,
  ghostBoardIds: [] as string[],
  phase: 'create' as OnboardingPhase,
  guideSubSteps: [] as GuideStep[],
  guideSubIndex: 0,
  guideBoardType: '',
};

interface OnboardingState {
  active: boolean;
  currentIndex: number;
  ghostBoardIds: string[];
  phase: OnboardingPhase;
  guideSubSteps: GuideStep[];
  guideSubIndex: number;
  guideBoardType: string;
}

// --- Main store ---

interface KanbanState {
  projects: Task[];
  selectedProjectId: string | null;
  boards: Board[];
  selectedBoardId: string | null;
  boardTasks: Task[];
  selectedTaskId: string | null;
  editingTask: Task | null;
  isCreating: boolean;
  isCreatingBoard: boolean;
  isTrackWizardOpen: boolean;
  descriptionEditorItem: DescriptionEditorItem | null;
  selectedStageForPanel: { taskId: string; stageId: string } | null;
  navigationStack: (string | null)[];
  onboarding: OnboardingState;
  trackWizardStep: number;

  setProjects: (projects: Task[]) => void;
  selectProject: (id: string) => void;
  navigateBack: () => void;
  setBoards: (boards: Board[]) => void;
  setSelectedBoardId: (id: string | null) => void;
  setIsCreatingBoard: (v: boolean) => void;
  setBoardTasks: (tasks: Task[]) => void;
  setSelectedTaskId: (id: string | null) => void;
  setEditingTask: (task: Task | null) => void;
  setIsCreating: (v: boolean) => void;
  setIsTrackWizardOpen: (v: boolean) => void;
  setDescriptionEditorItem: (item: DescriptionEditorItem | null) => void;
  setSelectedStageForPanel: (v: { taskId: string; stageId: string } | null) => void;
  startOnboarding: (ghostBoardIds: string[]) => void;
  createOnboardingBoard: () => Promise<void>;
  skipOnboardingBoard: () => void;
  dismissOnboarding: () => void;
  advanceGuideSubStep: () => void;
  setTrackWizardStep: (step: number) => void;

  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  currentParentId: string | null;
  setIsLoading: (v: boolean) => void;
  isLoading: boolean;
  zoomingIn: boolean;
  zoomingOut: boolean;
  focusedProjectId: string | null;
  setCurrentParentId: (id: string | null) => void;
  navigateInto: (projectId: string) => void;
  setZoomingIn: (v: boolean) => void;
  setZoomingOut: (v: boolean) => void;
  setFocusedProjectId: (id: string | null) => void;
  getSelectedTask: () => Task | undefined;
  getSelectedBoard: () => Board | undefined;
  getBreadcrumb: () => { id: string | null; title: string }[];
}

function moveToNextBoard(onboarding: OnboardingState): OnboardingState {
  const remaining = onboarding.ghostBoardIds.slice(onboarding.currentIndex + 1);
  if (remaining.length === 0) return { ...DEFAULT_ONBOARDING };
  return {
    ...DEFAULT_ONBOARDING,
    active: true,
    currentIndex: onboarding.currentIndex + 1,
    ghostBoardIds: onboarding.ghostBoardIds,
    phase: 'create',
  };
}

export const useKanbanStore = create<KanbanState>((set, get) => ({
  projects: [],
  selectedProjectId: null,
  boards: [],
  selectedBoardId: null,
  boardTasks: [],
  selectedTaskId: null,
  editingTask: null,
  isCreating: false,
  isCreatingBoard: false,
  isTrackWizardOpen: false,
  descriptionEditorItem: null,
  selectedStageForPanel: null,
  navigationStack: [null],
  onboarding: { ...DEFAULT_ONBOARDING },
  trackWizardStep: -1,

  setProjects: (projects) => set({ projects }),
  selectProject: (id) => {
    const { navigationStack } = get();
    set({
      selectedProjectId: id,
      currentParentId: id,
      navigationStack: [...navigationStack, id],
      boards: [],
      selectedBoardId: null,
      boardTasks: [],
      selectedTaskId: null,
      editingTask: null,
      isCreating: false,
      isTrackWizardOpen: false,
      descriptionEditorItem: null,
      selectedStageForPanel: null,
      onboarding: { ...DEFAULT_ONBOARDING },
      trackWizardStep: -1,
    });
  },
  navigateBack: () => {
    const { navigationStack } = get();
    if (navigationStack.length <= 1) return;
    const newStack = navigationStack.slice(0, -1);
    const parentId = newStack[newStack.length - 1];
    set({
      currentParentId: parentId,
      navigationStack: newStack,
      selectedProjectId: parentId,
      boards: [],
      selectedBoardId: null,
      boardTasks: [],
      selectedTaskId: null,
      editingTask: null,
      isCreating: false,
      isTrackWizardOpen: false,
      descriptionEditorItem: null,
      selectedStageForPanel: null,
      onboarding: { ...DEFAULT_ONBOARDING },
      trackWizardStep: -1,
    });
  },

  setBoards: (boards) => set({ boards }),
  setSelectedBoardId: (id) => set({ selectedBoardId: id, boardTasks: [], selectedTaskId: null, editingTask: null, isCreating: false, isTrackWizardOpen: false, descriptionEditorItem: null, selectedStageForPanel: null, trackWizardStep: -1 }),
  setIsCreatingBoard: (v) => set({ isCreatingBoard: v }),

  setBoardTasks: (tasks) => set({ boardTasks: tasks }),
  setSelectedTaskId: (id) => set({ selectedTaskId: id, editingTask: null, descriptionEditorItem: null, selectedStageForPanel: null }),
  setEditingTask: (task) => set({ editingTask: task, isCreating: false }),
  setIsCreating: (v) => set({ isCreating: v, editingTask: null }),
  setIsTrackWizardOpen: (v) => set({ isTrackWizardOpen: v, isCreating: false, editingTask: null }),
  setDescriptionEditorItem: (item) => set({ descriptionEditorItem: item, selectedStageForPanel: null }),
  setSelectedStageForPanel: (v) => set({ selectedStageForPanel: v, descriptionEditorItem: null }),

  startOnboarding: (ghostBoardIds) => {
    if (ghostBoardIds.length === 0) return;
    const { onboarding } = get();
    if (onboarding.active &&
        onboarding.ghostBoardIds.length === ghostBoardIds.length &&
        onboarding.ghostBoardIds[0] === ghostBoardIds[0]) return;
    set({
      onboarding: { ...DEFAULT_ONBOARDING, active: true, ghostBoardIds },
      selectedBoardId: null,
    });
  },
  createOnboardingBoard: async () => {
    const { onboarding, selectedProjectId, boards } = get();
    if (!onboarding.active || onboarding.phase !== 'create' || !selectedProjectId) return;
    const currentGhostId = onboarding.ghostBoardIds[onboarding.currentIndex];
    if (!currentGhostId) return;

    await fetch('/api/boards', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: currentGhostId, activateGhost: true }),
    });

    const updatedBoards = boards.map(b =>
      b.id === currentGhostId ? { ...b, isGhost: false } : b
    );
    const activatedBoard = updatedBoards.find(b => b.id === currentGhostId);
    const boardConfig = activatedBoard ? BOARD_ONBOARDING[activatedBoard.title] : undefined;
    const guideSteps = boardConfig?.guideSteps ?? [];

    set({
      boards: updatedBoards,
      selectedBoardId: currentGhostId,
      boardTasks: [],
      selectedTaskId: null,
      editingTask: null,
      isCreating: false,
      isTrackWizardOpen: false,
      descriptionEditorItem: null,
      selectedStageForPanel: null,
      trackWizardStep: -1,
      onboarding: {
        ...onboarding,
        phase: 'guide',
        guideSubSteps: guideSteps,
        guideSubIndex: 0,
        guideBoardType: activatedBoard?.boardType ?? '',
      },
    });
  },
  advanceGuideSubStep: () => {
    const { onboarding } = get();
    if (!onboarding.active || onboarding.phase !== 'guide') return;
    const nextIndex = onboarding.guideSubIndex + 1;
    if (nextIndex >= onboarding.guideSubSteps.length) {
      set({ onboarding: moveToNextBoard(onboarding) });
    } else {
      set({ onboarding: { ...onboarding, guideSubIndex: nextIndex } });
    }
  },
  skipOnboardingBoard: () => {
    const { onboarding } = get();
    if (!onboarding.active) return;
    set({ onboarding: moveToNextBoard(onboarding) });
  },
  dismissOnboarding: () => {
    set({ onboarding: { ...DEFAULT_ONBOARDING } });
  },
  setTrackWizardStep: (step) => set({ trackWizardStep: step }),

  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  currentParentId: null,
  setIsLoading: () => {},
  isLoading: false,
  zoomingIn: false,
  zoomingOut: false,
  focusedProjectId: null,
  setCurrentParentId: (id) => set({ currentParentId: id }),
  navigateInto: (projectId) => {
    const { navigationStack } = get();
    set({
      currentParentId: projectId,
      selectedProjectId: projectId,
      navigationStack: [...navigationStack, projectId],
      selectedTaskId: null,
      editingTask: null,
      isCreating: false,
      boards: [],
      selectedBoardId: null,
      boardTasks: [],
    });
  },
  setZoomingIn: () => {},
  setZoomingOut: () => {},
  setFocusedProjectId: () => {},
  getSelectedTask: () => {
    const { boardTasks, selectedTaskId } = get();
    return boardTasks.find((t) => t.id === selectedTaskId);
  },
  getSelectedBoard: () => {
    const { boards, selectedBoardId } = get();
    return boards.find((b) => b.id === selectedBoardId);
  },
  getBreadcrumb: () => [{ id: null, title: 'Все проекты' }],
}));
