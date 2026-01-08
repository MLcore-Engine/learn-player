// 视频相关的reducer
export const videoReducer = (state, action) => {
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

// 时间统计的reducer
export const timeStatsReducer = (state, action) => {
  switch (action.type) {
    case 'UPDATE_STATS':
      return { 
        ...state, 
        ...(action.payload) // 支持部分更新
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

// AI学习助手的reducer
export const aiReducer = (state, action) => {
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
        records: [action.payload, ...state.records].slice(0, 100) // 限制最多保存100条记录
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

// OCR识别的reducer
export const ocrReducer = (state, action) => {
  switch (action.type) {
    case 'SET_RESULT':
      return { ...state, result: action.payload };
    case 'SET_MODAL_OPEN':
      return { ...state, isModalOpen: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'CLEAR_RESULT':
      return { ...state, result: '' };
    default:
      return state;
  }
};

// API Key设置的reducer
export const apiKeyReducer = (state, action) => {
  switch (action.type) {
    case 'SET_API_KEY':
      return { ...state, apiKey: action.payload };
    case 'SET_MODEL_URL':
      return { ...state, modelUrl: action.payload };
    case 'SET_SHOW_INPUT':
      return { ...state, showInput: action.payload };
    case 'SET_STATUS':
      return { ...state, status: action.payload };
    default:
      return state;
  }
};
