/**
 * Reducer state shapes + discriminated union actions.
 * 对应 src/reducers/index.js 的 4 个 reducer + src/contexts/AppContext.js 的 errorReducer。
 */

// ============ video ============
export interface VideoState {
  videoPath: string | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  subtitleText: string;
  isLoaded: boolean;
}

export type VideoAction =
  | { type: 'SET_VIDEO_PATH'; payload: string | null }
  | { type: 'SET_CURRENT_TIME'; payload: number }
  | { type: 'SET_DURATION'; payload: number }
  | { type: 'SET_IS_PLAYING'; payload: boolean }
  | { type: 'SET_SUBTITLE_TEXT'; payload: string }
  | { type: 'SET_VIDEO_LOADED'; payload: boolean };

// ============ time stats ============
export interface TimeStatsState {
  totalTime: number;
  sessionTime: number;
}

export type TimeStatsAction =
  | { type: 'UPDATE_STATS'; payload: Partial<TimeStatsState> }
  | { type: 'INCREMENT_SESSION_TIME'; payload?: number }
  | { type: 'INCREMENT_TOTAL_TIME'; payload?: number }
  | { type: 'RESET_SESSION_TIME' };

// ============ AI ============
export interface AiRecord {
  subtitle_text: string;
  explanation: string;
  timestamp: number;
}

export interface AiState {
  selectedText: string;
  explanation: string;
  loading: boolean;
  records: AiRecord[];
}

export type AiAction =
  | { type: 'SET_SELECTED_TEXT'; payload: string }
  | { type: 'SET_EXPLANATION'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'ADD_RECORD'; payload: AiRecord }
  | { type: 'CLEAR_RECORDS' }
  | { type: 'REMOVE_RECORD'; payload: number };

// ============ API key ============
export type ConfigSourceKind = 'default' | 'env' | 'store';

export interface ApiKeyState {
  apiKey: string;
  modelUrl: string;
  showInput: boolean;
  status: string;
  configSource: {
    apiKey: ConfigSourceKind | string;
    modelUrl: ConfigSourceKind | string;
  };
}

export type ApiKeyAction =
  | { type: 'SET_API_KEY'; payload: string }
  | { type: 'SET_MODEL_URL'; payload: string }
  | { type: 'SET_SHOW_INPUT'; payload: boolean }
  | { type: 'SET_STATUS'; payload: string }
  | { type: 'SET_CONFIG_SOURCE'; payload: ApiKeyState['configSource'] };

// ============ error ============
export interface ErrorState {
  error: unknown;
  showError: boolean;
}

export type ErrorAction =
  | { type: 'SET_ERROR'; payload: unknown }
  | { type: 'HIDE_ERROR' }
  | { type: 'CLEAR_ERROR' };
