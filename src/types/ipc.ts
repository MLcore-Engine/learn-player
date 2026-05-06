/**
 * ElectronAPI — renderer 侧通过 window.electronAPI 访问主进程能力。
 * 必须与 preload.js 里 contextBridge.exposeInMainWorld('electronAPI', {...}) 的字段**逐字对齐**。
 * 字段签名对应 main/ipc/index.js 的 ipcMain.handle / ipcMain.on 返回值。
 */
import type {
  CreateHighlightInput,
  CreateHighlightResult,
  Highlight,
  HighlightsStats,
  HighlightDailyCount,
  GetHighlightsOptions,
  GetDueHighlightsOptions,
  SubmitReviewOptions,
  SubmitReviewResult,
  HighlightStatus
} from './highlight';
import type {
  StudyPlanRow,
  SaveStudyPlanPayload
} from './plan';

// ============ 基础 IPC 动词 ============

export type IpcInvoke = (channel: string, ...args: unknown[]) => Promise<unknown>;
export type IpcSend = (channel: string, ...args: unknown[]) => void;
export type IpcListener = (...args: unknown[]) => void;

export type IpcOn = (channel: string, listener: IpcListener) => () => void;
export type IpcRemoveListener = (channel: string, listener: IpcListener) => void;
export type IpcRemoveAllListeners = (channel: string) => void;

// ============ 具体方法返回类型 ============

export interface SelectVideoRawResult {
  success?: boolean;
  canceled?: boolean;
  path?: string;
  error?: string;
}

export interface SelectVideoResult {
  success: boolean;
  path: string | null;
  error: string | null;
}

export interface SelectSubtitleResult {
  success?: boolean;
  canceled?: boolean;
  path?: string;
  error?: string;
}

export interface ExtractFrameResult {
  success: boolean;
  dataUrl?: string;
  error?: string;
}

export interface WatchTime {
  totalTime: number;
  sessionTime: number;
  lastPosition: number;
}

export interface WatchTimeUpdate {
  videoId: string;
  deltaSeconds: number;
  currentPosition: number;
}

export interface LearningRecord {
  id: number;
  video_id: string | null;
  subtitle_id: number | null;
  content: string | null;
  translation: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaveApiKeyPayload {
  apiKey: string;
  modelUrl: string;
}

/** getApiKey handler 返回形态（见 main/ipc/index.js getApiKey） */
export interface ApiKeyResult {
  success: boolean;
  apiKey?: string;
  modelUrl?: string;
  source?: { apiKey: string; modelUrl: string };
  error?: string;
}

export interface PerformAIRequestResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ExportPdfPayload {
  html: string;
  title: string;
  suggestedName: string;
}

export interface ExportPdfResult {
  success?: boolean;
  filePath?: string;
  canceled?: boolean;
  error?: string;
}

export interface PrepareVideoResult {
  success?: boolean;
  path?: string;
  error?: string;
}

export interface UpdatePlanProgressPayload {
  progress: number;
}

// ============ 主 API 接口 ============

export interface ElectronAPI {
  // 通用 IPC 动词
  invoke: IpcInvoke;
  send: IpcSend;
  on: IpcOn;
  removeListener: IpcRemoveListener;
  removeAllListeners: IpcRemoveAllListeners;

  // 系统
  platform: NodeJS.Platform;

  // API Key
  saveApiKey: (payload: SaveApiKeyPayload) => Promise<{ success?: boolean; error?: string }>;
  getApiKey: () => Promise<ApiKeyResult | null>;

  // 文件/视频选择
  selectVideo: () => Promise<SelectVideoRawResult>;
  selectSubtitle: (videoPath: string) => Promise<SelectSubtitleResult>;
  extractFrame: (videoPath: string, timestamp: number) => Promise<ExtractFrameResult>;

  // 观看时长
  getWatchTime: (videoId: string) => Promise<WatchTime>;
  updateWatchTime: (watchTimeData: WatchTimeUpdate) => void;

  // 学习记录（legacy learning_records 表）
  saveLearningRecord: (record: Partial<LearningRecord>) => Promise<{ success?: boolean; id?: number; error?: string }>;
  getLearningRecords: (videoId: string) => Promise<LearningRecord[]>;

  // AI 请求（主进程代理）
  performAIRequest: (
    requestData: unknown,
    apiUrl: string,
    apiKey: string
  ) => Promise<PerformAIRequestResult>;
  performAIStream: (
    requestData: unknown,
    apiUrl: string,
    apiKey: string
  ) => Promise<{ success?: boolean; requestId?: string; error?: string }>;

  // 视频 HTTP 服务
  getVideoServerPort: () => Promise<number | null>;
  getVideoHttpUrl: (videoPath: string) => Promise<string>;
  prepareVideo: (filePath: string) => Promise<PrepareVideoResult>;
  cleanupVideoCache: () => Promise<{ success?: boolean; error?: string }>;
  checkFileExists: (filePath: string) => Promise<boolean>;

  // 字典
  lookupWord: (word: string) => Promise<unknown>;

  // PDF 导出
  'export-learning-today-pdf'?: (payload: ExportPdfPayload) => Promise<ExportPdfResult>;

  // 学习计划
  saveStudyPlan: (data: SaveStudyPlanPayload) => Promise<{ success?: boolean; error?: string }>;
  getCurrentStudyPlan: () => Promise<StudyPlanRow | null>;
  updatePlanProgress: (progress: UpdatePlanProgressPayload) => Promise<{ success?: boolean; error?: string }>;

  // highlights CRUD
  createHighlight: (data: CreateHighlightInput) => Promise<CreateHighlightResult>;
  getHighlights: (params: GetHighlightsOptions) => Promise<Highlight[] | { error: string }>;
  getHighlight: (params: { id: string }) => Promise<Highlight | { error: string }>;
  updateHighlight: (params: { id: string } & Partial<Highlight>) => Promise<{ success?: boolean; error?: string }>;
  deleteHighlight: (params: { id: string }) => Promise<{ success?: boolean; error?: string }>;

  // highlights SRS
  getDueHighlights: (params: GetDueHighlightsOptions) => Promise<Highlight[] | { error: string }>;
  submitReview: (params: SubmitReviewOptions) => Promise<SubmitReviewResult>;

  // highlights Stats
  getHighlightsStats: () => Promise<HighlightsStats>;
  getHighlightsDailyCount: (params: { days?: number }) => Promise<HighlightDailyCount[] | { error: string }>;
  getTodayHighlights: () => Promise<Highlight[] | { error: string }>;
}

// ============ 对 HighlightStatus 的兼容重导出，防止循环依赖 ============
export type { HighlightStatus };
