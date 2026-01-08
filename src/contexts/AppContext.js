import React, { createContext, useContext, useReducer, useRef } from 'react';
import { 
  videoReducer, 
  timeStatsReducer, 
  aiReducer, 
  apiKeyReducer 
} from '../reducers';
import { ipcClient } from '../services/ipcClient';

// 创建各个功能模块的上下文
const VideoContext = createContext();
const TimeStatsContext = createContext();
const AIContext = createContext();
const ApiKeyContext = createContext();

// 创建错误处理上下文
const ErrorContext = createContext();

// 错误处理reducer
const errorReducer = (state, action) => {
  switch (action.type) {
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        showError: true
      };
    case 'HIDE_ERROR':
      return {
        ...state,
        showError: false
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
        showError: false
      };
    default:
      return state;
  }
};

// 导出自定义钩子，便于组件使用
export const useVideo = () => {
  const context = useContext(VideoContext);
  if (!context) {
    throw new Error('useVideo must be used within a VideoProvider');
  }
  return context;
};

export const useTimeStats = () => {
  const context = useContext(TimeStatsContext);
  if (!context) {
    throw new Error('useTimeStats must be used within a TimeStatsProvider');
  }
  return context;
};

export const useAI = () => {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAI must be used within a AIProvider');
  }
  return context;
};

export const useApiKey = () => {
  const context = useContext(ApiKeyContext);
  if (!context) {
    throw new Error('useApiKey must be used within a ApiKeyProvider');
  }
  return context;
};

// 错误处理Provider
export const ErrorProvider = ({ children }) => {
  const [state, dispatch] = useReducer(errorReducer, {
    error: null,
    showError: false
  });

  const actions = {
    setError: (error) => dispatch({ type: 'SET_ERROR', payload: error }),
    hideError: () => dispatch({ type: 'HIDE_ERROR' }),
    clearError: () => dispatch({ type: 'CLEAR_ERROR' })
  };

  return (
    <ErrorContext.Provider value={{ ...state, ...actions }}>
      {children}
    </ErrorContext.Provider>
  );
};

// 错误处理Hook
export const useError = () => {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
};

// 视频相关Provider
export const VideoProvider = ({ children }) => {
  const [state, dispatch] = useReducer(videoReducer, {
    videoPath: null,
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    subtitleText: '',
    isLoaded: false // 视频加载状态
  });
  
  const videoRef = useRef(null);
  const playerRef = useRef(null); // 存储 video.js player 实例

  // 确保actions是稳定的引用
  const actions = React.useMemo(() => ({
    setVideoPath: (path) => dispatch({ type: 'SET_VIDEO_PATH', payload: path }),
    setCurrentTime: (time) => dispatch({ type: 'SET_CURRENT_TIME', payload: time }),
    setDuration: (duration) => dispatch({ type: 'SET_DURATION', payload: duration }),
    setIsPlaying: (isPlaying) => dispatch({ type: 'SET_IS_PLAYING', payload: isPlaying }),
    setSubtitleText: (text) => dispatch({ type: 'SET_SUBTITLE_TEXT', payload: text }),
    setVideoLoaded: (loaded) => dispatch({ type: 'SET_VIDEO_LOADED', payload: loaded }),
    setPlayer: (player) => { playerRef.current = player; } // 新增：设置 player 实例
  }), []); // 空依赖数组，确保actions只创建一次

  return (
    <VideoContext.Provider value={{ 
      ...state, 
      ...actions,
      videoRef,
      playerRef // 新增：暴露 playerRef
    }}>
      {children}
    </VideoContext.Provider>
  );
};

// 时间统计Provider
export const TimeStatsProvider = ({ children }) => {
  const [state, dispatch] = useReducer(timeStatsReducer, {
    totalTime: 0,
    sessionTime: 0
  });
  
  // 存储最新的观看时长引用，避免闭包陷阱
  const timeStatsRef = useRef({ totalTime: 0, sessionTime: 0 });
  // 保存定时器引用
  const watchTimerRef = useRef(null);

  // 同步ref和state
  React.useEffect(() => {
    timeStatsRef.current = state;
  }, [state]);

  const actions = {
    updateStats: (stats) => {
      dispatch({ type: 'UPDATE_STATS', payload: stats });
    },
    incrementSessionTime: (seconds = 60) => {
      dispatch({ type: 'INCREMENT_SESSION_TIME', payload: seconds });
    },
    incrementTotalTime: (seconds = 60) => {
      dispatch({ type: 'INCREMENT_TOTAL_TIME', payload: seconds });
    },
    resetSessionTime: () => {
      dispatch({ type: 'RESET_SESSION_TIME' });
    },
    // 启动观看时长定时器
    startWatchTimer: (videoPath, videoRef) => {
      if (watchTimerRef.current || !videoPath || !videoRef.current) return;
      
      watchTimerRef.current = setInterval(() => {
        const newTotal = timeStatsRef.current.totalTime + 60;
        const newSession = timeStatsRef.current.sessionTime + 60;
        const currentPosition = Math.floor(videoRef.current.currentTime);

        // 更新到数据库（以增量为准，避免被0覆盖历史累计）
        if (ipcClient.isAvailable()) {
          ipcClient.updateWatchTime({
            videoId: videoPath,
            deltaSeconds: 60,
            currentPosition
          });
        }

        // 更新本地状态
        dispatch({
          type: 'UPDATE_STATS',
          payload: { totalTime: newTotal, sessionTime: newSession }
        });
      }, 60000);
    },
    // 停止观看时长定时器
    stopWatchTimer: () => {
      if (watchTimerRef.current) {
        clearInterval(watchTimerRef.current);
        watchTimerRef.current = null;
      }
    }
  };

  return (
    <TimeStatsContext.Provider value={{ 
      ...state, 
      ...actions,
      timeStatsRef,
      watchTimerRef
    }}>
      {children}
    </TimeStatsContext.Provider>
  );
};

// AI助手Provider
export const AIProvider = ({ children }) => {
  const [state, dispatch] = useReducer(aiReducer, {
    selectedText: '',
    explanation: '',
    loading: false,
    records: []
  });

  const actions = {
    setSelectedText: (text) => {
      dispatch({ type: 'SET_SELECTED_TEXT', payload: text });
    },
    setExplanation: (explanation) => {
      dispatch({ type: 'SET_EXPLANATION', payload: explanation });
    },
    setLoading: (loading) => {
      dispatch({ type: 'SET_LOADING', payload: loading });
    },
    addRecord: (record) => {
      dispatch({ type: 'ADD_RECORD', payload: record });
    },
    clearRecords: () => {
      dispatch({ type: 'CLEAR_RECORDS' });
    },
    removeRecord: (index) => {
      dispatch({ type: 'REMOVE_RECORD', payload: index });
    }
  };

  return (
    <AIContext.Provider value={{ ...state, ...actions }}>
      {children}
    </AIContext.Provider>
  );
};

// API Key设置Provider
export const ApiKeyProvider = ({ children }) => {
  const [state, dispatch] = useReducer(apiKeyReducer, {
    apiKey: '',
    modelUrl: 'http://58.211.207.202:20000/api/chat', // 默认值
    showInput: false,
    status: '正在加载...',
    configSource: { apiKey: 'default', modelUrl: 'default' }
  });

  const actions = {
    setApiKey: (apiKey) => {
      dispatch({ type: 'SET_API_KEY', payload: apiKey });
    },
    setModelUrl: (modelUrl) => {
      dispatch({ type: 'SET_MODEL_URL', payload: modelUrl });
    },
    setShowInput: (show) => {
      dispatch({ type: 'SET_SHOW_INPUT', payload: show });
    },
    setStatus: (status) => {
      dispatch({ type: 'SET_STATUS', payload: status });
    },
    setConfigSource: (configSource) => {
      dispatch({ type: 'SET_CONFIG_SOURCE', payload: configSource });
    }
  };

  return (
    <ApiKeyContext.Provider value={{ ...state, ...actions }}>
      {children}
    </ApiKeyContext.Provider>
  );
};

// 旧OCR Context已移除，避免全局状态膨胀
