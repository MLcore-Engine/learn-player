/**
 * IPC client wrapper for renderer process.
 * All IPC channel names are centralized here to avoid string literals in callers.
 */
import { getElectronAPI, isElectronAvailable } from './electronApi';
import type {
  ElectronAPI,
  IpcListener,
  SelectVideoRawResult,
  SelectVideoResult,
  SelectSubtitleResult,
  ExtractFrameResult,
  WatchTime,
  WatchTimeUpdate,
  SaveApiKeyPayload,
  ApiKeyResult,
  PerformAIRequestResult,
  ExportPdfPayload,
  ExportPdfResult,
  PrepareVideoResult,
  UpdatePlanProgressPayload
} from '../types/ipc';
import type {
  CreateHighlightInput,
  CreateHighlightResult,
  Highlight,
  HighlightsStats,
  HighlightDailyCount,
  GetHighlightsOptions,
  GetDueHighlightsOptions,
  SubmitReviewOptions,
  SubmitReviewResult
} from '../types/highlight';
import type {
  StudyPlanRow,
  SaveStudyPlanPayload
} from '../types/plan';
import type {
  StoryRow,
  GenerateTTSPayload,
  GenerateTTSResult,
  ReadAudioFileResult,
  SaveStoryPayload,
  SaveStoryResult,
  UpdateStoryAudioPayload,
  DownloadStoryFilePayload,
  DownloadStoryFileResult
} from '../types/story';

export const IPC_CHANNELS = {
  invoke: {
    performAIRequest: 'performAIRequest',
    performAIStream: 'performAIStream',
    extractFrame: 'extract-frame',
    selectSubtitle: 'selectSubtitle',
    selectVideo: 'selectVideo',
    getWatchTime: 'getWatchTime',
    saveApiKey: 'saveApiKey',
    getApiKey: 'getApiKey',
    exportLearningTodayPdf: 'export-learning-today-pdf',
    getVideoServerPort: 'getVideoServerPort',
    prepareVideo: 'prepareVideo',
    cleanupVideoCache: 'cleanupVideoCache',
    checkFileExists: 'checkFileExists',
    lookupWord: 'lookupWord',
    saveStudyPlan: 'saveStudyPlan',
    getCurrentStudyPlan: 'getCurrentStudyPlan',
    updatePlanProgress: 'updatePlanProgress',
    createHighlight: 'createHighlight',
    getHighlights: 'getHighlights',
    getHighlight: 'getHighlight',
    updateHighlight: 'updateHighlight',
    deleteHighlight: 'deleteHighlight',
    getDueHighlights: 'getDueHighlights',
    submitReview: 'submitReview',
    getHighlightsStats: 'getHighlightsStats',
    getHighlightsDailyCount: 'getHighlightsDailyCount',
    getTodayHighlights: 'getTodayHighlights',
    generateTTS: 'generateTTS',
    readAudioFile: 'readAudioFile',
    saveStory: 'saveStory',
    updateStoryAudio: 'updateStoryAudio',
    getStories: 'getStories',
    getStory: 'getStory',
    deleteStory: 'deleteStory',
    downloadStoryFile: 'downloadStoryFile'
  },
  send: {
    updateWatchTime: 'updateWatchTime',
    loadSubtitle: 'loadSubtitle'
  },
  receive: {
    watchTime: 'watchTime',
    error: 'error',
    databaseInitError: 'databaseInitError',
    learningRecords: 'learningRecords',
    subtitleLoaded: 'subtitleLoaded',
    videoSelectedFromMenu: 'videoSelectedFromMenu',
    openApiKeySettings: 'openApiKeySettings',
    updateAvailable: 'update-available',
    updateDownloaded: 'update-downloaded',
    watchTimeUpdated: 'watchTimeUpdated',
    learningRecordDeleted: 'learningRecordDeleted',
    learningStats: 'learningStats',
    databaseStatus: 'databaseStatus',
    aiStream: 'ai-stream',
    conversionProgress: 'conversion-progress',
    conversionComplete: 'conversion-complete'
  }
} as const;

const createUnavailableError = () => new Error('Electron API不可用');

const normalizeSelectVideoResult = (rawResult: SelectVideoRawResult | null | undefined): SelectVideoResult => {
  if (!rawResult || typeof rawResult !== 'object') {
    console.warn('selectVideo 返回结构异常，已兜底:', rawResult);
    return { success: false, path: null, error: '返回结构异常' };
  }

  if (rawResult.success === true) {
    if (typeof rawResult.path === 'string' && rawResult.path.length > 0) {
      return { success: true, path: rawResult.path, error: null };
    }
    console.warn('selectVideo 返回缺少路径，已兜底:', rawResult);
    return { success: false, path: null, error: '返回缺少路径' };
  }

  if (rawResult.canceled) {
    return { success: false, path: null, error: '用户取消选择' };
  }

  if (typeof rawResult.path === 'string' && rawResult.path.length > 0) {
    console.warn('selectVideo 返回缺少 success 字段，已兼容:', rawResult);
    return { success: true, path: rawResult.path, error: null };
  }

  if (typeof rawResult.error === 'string' && rawResult.error.length > 0) {
    return { success: false, path: null, error: rawResult.error };
  }

  console.warn('selectVideo 返回未知结构，已兜底:', rawResult);
  return { success: false, path: null, error: '未知错误' };
};

const invoke = async <T = unknown>(channel: string, ...args: unknown[]): Promise<T> => {
  const api = getElectronAPI();
  if (!api?.invoke) {
    throw createUnavailableError();
  }
  return (await api.invoke(channel, ...args)) as T;
};

const send = (channel: string, ...args: unknown[]): void => {
  const api = getElectronAPI();
  if (!api?.send) {
    console.error('Electron API不可用，无法发送IPC消息');
    return;
  }
  api.send(channel, ...args);
};

const on = (channel: string, listener: IpcListener): (() => void) => {
  const api = getElectronAPI();
  if (!api?.on) {
    console.error('Electron API不可用，无法监听IPC事件');
    return () => {};
  }
  return api.on(channel, listener);
};

const removeAllListeners = (channel: string): void => {
  const api = getElectronAPI();
  if (!api?.removeAllListeners) {
    return;
  }
  api.removeAllListeners(channel);
};

export interface IpcClient {
  isAvailable: () => boolean;

  onVideoSelectedFromMenu: (listener: IpcListener) => () => void;
  onSubtitleLoaded: (listener: IpcListener) => () => void;
  onOpenApiKeySettings: (listener: IpcListener) => () => void;
  onAiStream: (listener: IpcListener) => () => void;
  onConversionProgress: (listener: IpcListener) => () => void;
  onConversionComplete: (listener: IpcListener) => () => void;
  removeAllListeners: (channel: string) => void;

  selectVideo: () => Promise<SelectVideoResult>;
  selectSubtitle: (videoPath: string) => Promise<SelectSubtitleResult>;
  extractFrame: (videoPath: string, timestamp: number) => Promise<ExtractFrameResult>;
  getWatchTime: (videoId: string) => Promise<WatchTime>;
  updateWatchTime: (watchTimeData: WatchTimeUpdate) => void;
  loadSubtitle: (subtitlePath: string) => void;
  checkFileExists: (filePath: string) => Promise<boolean>;

  performAIRequest: (requestData: unknown, apiUrl: string, apiKey: string) => Promise<PerformAIRequestResult>;
  performAIStream: (requestData: unknown, apiUrl: string, apiKey: string) => Promise<{ success?: boolean; requestId?: string; error?: string }>;

  getApiKey: () => Promise<ApiKeyResult | null>;
  saveApiKey: (payload: SaveApiKeyPayload) => Promise<{ success?: boolean; error?: string }>;

  exportLearningTodayPdf: (payload: ExportPdfPayload) => Promise<ExportPdfResult>;

  getVideoServerPort: () => Promise<number | null>;
  getVideoHttpUrl: (videoPath: string) => Promise<string>;
  prepareVideo: (filePath: string) => Promise<PrepareVideoResult>;
  cleanupVideoCache: () => Promise<{ success?: boolean; error?: string }>;

  lookupWord: (word: string) => Promise<unknown>;

  saveStudyPlan: (data: SaveStudyPlanPayload) => Promise<{ success?: boolean; error?: string }>;
  getCurrentStudyPlan: () => Promise<StudyPlanRow | null>;
  updatePlanProgress: (progress: UpdatePlanProgressPayload) => Promise<{ success?: boolean; error?: string }>;

  createHighlight: (data: CreateHighlightInput) => Promise<CreateHighlightResult>;
  getHighlights: (options: GetHighlightsOptions) => Promise<Highlight[] | { error: string }>;
  getHighlight: (options: { id: string }) => Promise<Highlight | { error: string }>;
  updateHighlight: (options: { id: string } & Partial<Highlight>) => Promise<{ success?: boolean; error?: string }>;
  deleteHighlight: (options: { id: string }) => Promise<{ success?: boolean; error?: string }>;
  getDueHighlights: (options: GetDueHighlightsOptions) => Promise<Highlight[] | { error: string }>;
  submitReview: (options: SubmitReviewOptions) => Promise<SubmitReviewResult>;
  getHighlightsStats: () => Promise<HighlightsStats>;
  getHighlightsDailyCount: (options: { days?: number }) => Promise<HighlightDailyCount[] | { error: string }>;
  getTodayHighlights: () => Promise<Highlight[] | { error: string }>;

  // 故事 / TTS
  generateTTS: (payload: GenerateTTSPayload) => Promise<GenerateTTSResult>;
  readAudioFile: (filePath: string) => Promise<ReadAudioFileResult>;
  saveStory: (payload: SaveStoryPayload) => Promise<SaveStoryResult>;
  updateStoryAudio: (payload: UpdateStoryAudioPayload) => Promise<{ success?: boolean; error?: string }>;
  getStories: (params?: { limit?: number; offset?: number }) => Promise<StoryRow[] | { error: string }>;
  getStory: (params: { id: number }) => Promise<StoryRow | null | { error: string }>;
  deleteStory: (params: { id: number }) => Promise<{ success?: boolean; error?: string }>;
  downloadStoryFile: (payload: DownloadStoryFilePayload) => Promise<DownloadStoryFileResult>;
}

export const ipcClient: IpcClient = {
  isAvailable: () => isElectronAvailable(),
  onVideoSelectedFromMenu: (listener) => on(IPC_CHANNELS.receive.videoSelectedFromMenu, listener),
  onSubtitleLoaded: (listener) => on(IPC_CHANNELS.receive.subtitleLoaded, listener),
  onOpenApiKeySettings: (listener) => on(IPC_CHANNELS.receive.openApiKeySettings, listener),
  onAiStream: (listener) => on(IPC_CHANNELS.receive.aiStream, listener),
  onConversionProgress: (listener) => on(IPC_CHANNELS.receive.conversionProgress, listener),
  onConversionComplete: (listener) => on(IPC_CHANNELS.receive.conversionComplete, listener),
  removeAllListeners: (channel) => removeAllListeners(channel),

  selectVideo: async () => {
    const result = await invoke<SelectVideoRawResult>(IPC_CHANNELS.invoke.selectVideo);
    return normalizeSelectVideoResult(result);
  },
  selectSubtitle: (videoPath) => invoke(IPC_CHANNELS.invoke.selectSubtitle, { videoPath }),
  extractFrame: (videoPath, timestamp) => invoke(IPC_CHANNELS.invoke.extractFrame, { videoPath, timestamp }),
  getWatchTime: (videoId) => {
    const api = getElectronAPI() as ElectronAPI;
    if (api.getWatchTime) {
      return api.getWatchTime(videoId);
    }
    return invoke(IPC_CHANNELS.invoke.getWatchTime, { videoId });
  },
  updateWatchTime: (watchTimeData) => send(IPC_CHANNELS.send.updateWatchTime, watchTimeData),
  loadSubtitle: (subtitlePath) => send(IPC_CHANNELS.send.loadSubtitle, { subtitlePath }),
  checkFileExists: (filePath) => invoke(IPC_CHANNELS.invoke.checkFileExists, filePath),

  performAIRequest: (requestData, apiUrl, apiKey) =>
    invoke(IPC_CHANNELS.invoke.performAIRequest, { requestData, apiUrl, apiKey }),
  performAIStream: (requestData, apiUrl, apiKey) =>
    invoke(IPC_CHANNELS.invoke.performAIStream, { requestData, apiUrl, apiKey }),

  getApiKey: () => {
    const api = getElectronAPI();
    if (!api?.getApiKey) {
      throw createUnavailableError();
    }
    return api.getApiKey();
  },
  saveApiKey: (payload) => invoke(IPC_CHANNELS.invoke.saveApiKey, payload),

  exportLearningTodayPdf: (payload) => invoke(IPC_CHANNELS.invoke.exportLearningTodayPdf, payload),

  getVideoServerPort: () => {
    const api = getElectronAPI() as ElectronAPI;
    if (api.getVideoServerPort) {
      return api.getVideoServerPort();
    }
    return invoke(IPC_CHANNELS.invoke.getVideoServerPort);
  },
  getVideoHttpUrl: (videoPath) => {
    const api = getElectronAPI();
    if (!api?.getVideoHttpUrl) {
      return Promise.reject(createUnavailableError());
    }
    return api.getVideoHttpUrl(videoPath);
  },
  prepareVideo: (filePath) => invoke(IPC_CHANNELS.invoke.prepareVideo, filePath),
  cleanupVideoCache: () => invoke(IPC_CHANNELS.invoke.cleanupVideoCache),

  lookupWord: (word) => invoke(IPC_CHANNELS.invoke.lookupWord, word),

  saveStudyPlan: (data) => invoke(IPC_CHANNELS.invoke.saveStudyPlan, data),
  getCurrentStudyPlan: () => invoke(IPC_CHANNELS.invoke.getCurrentStudyPlan),
  updatePlanProgress: (progress) => invoke(IPC_CHANNELS.invoke.updatePlanProgress, progress),

  createHighlight: (data) => invoke(IPC_CHANNELS.invoke.createHighlight, data),
  getHighlights: (options) => invoke(IPC_CHANNELS.invoke.getHighlights, options),
  getHighlight: (options) => invoke(IPC_CHANNELS.invoke.getHighlight, options),
  updateHighlight: (options) => invoke(IPC_CHANNELS.invoke.updateHighlight, options),
  deleteHighlight: (options) => invoke(IPC_CHANNELS.invoke.deleteHighlight, options),
  getDueHighlights: (options) => invoke(IPC_CHANNELS.invoke.getDueHighlights, options),
  submitReview: (options) => invoke(IPC_CHANNELS.invoke.submitReview, options),
  getHighlightsStats: () => invoke(IPC_CHANNELS.invoke.getHighlightsStats),
  getHighlightsDailyCount: (options) => invoke(IPC_CHANNELS.invoke.getHighlightsDailyCount, options),
  getTodayHighlights: () => invoke(IPC_CHANNELS.invoke.getTodayHighlights),

  generateTTS: (payload) => invoke(IPC_CHANNELS.invoke.generateTTS, payload),
  readAudioFile: (filePath) => invoke(IPC_CHANNELS.invoke.readAudioFile, filePath),
  saveStory: (payload) => invoke(IPC_CHANNELS.invoke.saveStory, payload),
  updateStoryAudio: (payload) => invoke(IPC_CHANNELS.invoke.updateStoryAudio, payload),
  getStories: (params) => invoke(IPC_CHANNELS.invoke.getStories, params || {}),
  getStory: (params) => invoke(IPC_CHANNELS.invoke.getStory, params),
  deleteStory: (params) => invoke(IPC_CHANNELS.invoke.deleteStory, params),
  downloadStoryFile: (payload) => invoke(IPC_CHANNELS.invoke.downloadStoryFile, payload)
};

export default ipcClient;
