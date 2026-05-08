import type { ElectronAPI } from '../types/ipc';

const fallbackElectronAPI: ElectronAPI = {
  invoke: async () => {
    throw new Error('Electron API不可用');
  },
  send: () => {},
  on: () => () => {},
  removeListener: () => {},
  removeAllListeners: () => {},
  platform: typeof process !== 'undefined' ? process.platform : 'browser' as NodeJS.Platform,
  saveApiKey: async () => ({ error: 'Electron API不可用' }),
  getApiKey: async () => null,
  selectVideo: async () => ({ error: 'Electron API不可用' }),
  selectSubtitle: async () => ({ error: 'Electron API不可用' }),
  extractFrame: async () => ({ success: false, error: 'Electron API不可用' }),
  getWatchTime: async () => ({ totalTime: 0, sessionTime: 0, lastPosition: 0 }),
  updateWatchTime: () => {},
  performAIRequest: async () => ({ success: false, error: 'Electron API不可用' }),
  performAIStream: async () => ({ error: 'Electron API不可用' }),
  getVideoServerPort: async () => null,
  getVideoHttpUrl: async () => { throw new Error('Electron API不可用'); },
  prepareVideo: async () => ({ error: 'Electron API不可用' }),
  cleanupVideoCache: async () => ({ error: 'Electron API不可用' }),
  checkFileExists: async () => false,
  lookupWord: async () => null,
  saveStudyPlan: async () => ({ error: 'Electron API不可用' }),
  getCurrentStudyPlan: async () => null,
  updatePlanProgress: async () => ({ error: 'Electron API不可用' }),
  createHighlight: async () => ({ error: 'Electron API不可用' }),
  getHighlights: async () => ({ error: 'Electron API不可用' }),
  getHighlight: async () => ({ error: 'Electron API不可用' }),
  updateHighlight: async () => ({ error: 'Electron API不可用' }),
  deleteHighlight: async () => ({ error: 'Electron API不可用' }),
  getDueHighlights: async () => ({ error: 'Electron API不可用' }),
  submitReview: async () => ({ error: 'Electron API不可用' }),
  getHighlightsStats: async () => ({
    totalHighlights: 0,
    pendingHighlights: 0,
    reviewedHighlights: 0,
    archivedHighlights: 0,
    masteredHighlights: 0,
    totalVideos: 0,
    todayReviewed: 0,
    streakDays: 0,
    error: 'Electron API不可用'
  }),
  getHighlightsDailyCount: async () => ({ error: 'Electron API不可用' }),
  getTodayHighlights: async () => ({ error: 'Electron API不可用' }),
  generateTTS: async () => ({ success: false, error: 'Electron API不可用' }),
  readAudioFile: async () => ({ success: false, error: 'Electron API不可用' }),
  saveStory: async () => ({ error: 'Electron API不可用' }),
  updateStoryAudio: async () => ({ error: 'Electron API不可用' }),
  getStories: async () => ({ error: 'Electron API不可用' }),
  getStory: async () => ({ error: 'Electron API不可用' }),
  deleteStory: async () => ({ error: 'Electron API不可用' }),
  downloadStoryFile: async () => ({ success: false, error: 'Electron API不可用' })
};

let mockElectronAPI: ElectronAPI | null = null;

const resolveElectronAPI = (): ElectronAPI | null => {
  if (mockElectronAPI) {
    return mockElectronAPI;
  }
  if (typeof window === 'undefined') {
    return null;
  }
  return window.electronAPI || null;
};

export const getElectronAPI = (): ElectronAPI => resolveElectronAPI() ?? fallbackElectronAPI;

export const isElectronAvailable = (): boolean => Boolean(resolveElectronAPI());

export const setElectronAPIMock = (mockApi: ElectronAPI | null): void => {
  mockElectronAPI = mockApi;
};

export default getElectronAPI;
