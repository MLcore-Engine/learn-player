import type {
  VideoState,
  VideoAction,
  TimeStatsState,
  TimeStatsAction,
  AiState,
  AiAction,
  ApiKeyState,
  ApiKeyAction
} from '../types/state';

// 视频相关的 reducer
export const videoReducer = (state: VideoState, action: VideoAction): VideoState => {
  switch (action.type) {
    case 'SET_VIDEO_PATH':
      return { ...state, videoPath: action.payload };
    case 'SET_CURRENT_TIME':
      return { ...state, currentTime: action.payload };
    case 'SET_DURATION':
      return { ...state, duration: action.payload };
    case 'SET_IS_PLAYING':
      return { ...state, isPlaying: action.payload };
    case 'SET_SUBTITLE_TEXT':
      return { ...state, subtitleText: action.payload };
    case 'SET_VIDEO_LOADED':
      return { ...state, isLoaded: action.payload };
    default:
      return state;
  }
};

// 时间统计的 reducer
export const timeStatsReducer = (state: TimeStatsState, action: TimeStatsAction): TimeStatsState => {
  switch (action.type) {
    case 'UPDATE_STATS':
      return {
        ...state,
        ...action.payload
      };
    case 'INCREMENT_SESSION_TIME':
      return {
        ...state,
        sessionTime: state.sessionTime + (action.payload || 60)
      };
    case 'INCREMENT_TOTAL_TIME':
      return {
        ...state,
        totalTime: state.totalTime + (action.payload || 60)
      };
    case 'RESET_SESSION_TIME':
      return {
        ...state,
        sessionTime: 0
      };
    default:
      return state;
  }
};

// AI 学习助手的 reducer
export const aiReducer = (state: AiState, action: AiAction): AiState => {
  switch (action.type) {
    case 'SET_SELECTED_TEXT':
      return { ...state, selectedText: action.payload };
    case 'SET_EXPLANATION':
      return { ...state, explanation: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'ADD_RECORD':
      return {
        ...state,
        records: [action.payload, ...state.records].slice(0, 100) // 限制最多保存 100 条记录
      };
    case 'CLEAR_RECORDS':
      return { ...state, records: [] };
    case 'REMOVE_RECORD':
      return {
        ...state,
        records: state.records.filter((_, index) => index !== action.payload)
      };
    default:
      return state;
  }
};

// API Key 设置的 reducer
export const apiKeyReducer = (state: ApiKeyState, action: ApiKeyAction): ApiKeyState => {
  switch (action.type) {
    case 'SET_API_KEY':
      return { ...state, apiKey: action.payload };
    case 'SET_MODEL_URL':
      return { ...state, modelUrl: action.payload };
    case 'SET_SHOW_INPUT':
      return { ...state, showInput: action.payload };
    case 'SET_STATUS':
      return { ...state, status: action.payload };
    case 'SET_CONFIG_SOURCE':
      return { ...state, configSource: action.payload };
    default:
      return state;
  }
};
