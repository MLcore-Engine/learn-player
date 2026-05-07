import React, {
  createContext,
  useContext,
  useReducer,
  useRef,
  useMemo,
  useEffect,
  type MutableRefObject,
  type ReactNode,
  type Dispatch
} from 'react';
import type Player from 'video.js/dist/types/player';
import {
  videoReducer,
  timeStatsReducer,
  aiReducer,
  apiKeyReducer
} from '../reducers';
import { ipcClient } from '../services/ipcClient';
import type {
  VideoState,
  TimeStatsState,
  AiState,
  ApiKeyState,
  ErrorState,
  ErrorAction
} from '../types/state';

// ============ Video ============

export interface VideoActions {
  setVideoPath: (path: string | null) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setSubtitleText: (text: string) => void;
  setVideoLoaded: (loaded: boolean) => void;
  setPlayer: (player: Player | null) => void;
  jumpToTime: (seconds: number) => void;
}

export interface VideoContextValue extends VideoState, VideoActions {
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  playerRef: MutableRefObject<Player | null>;
}

// ============ TimeStats ============

export interface TimeStatsActions {
  updateStats: (stats: Partial<TimeStatsState>) => void;
  incrementSessionTime: (seconds?: number) => void;
  incrementTotalTime: (seconds?: number) => void;
  resetSessionTime: () => void;
  startWatchTimer: (
    videoPath: string,
    videoRef: MutableRefObject<HTMLVideoElement | null>
  ) => void;
  stopWatchTimer: () => void;
}

export interface TimeStatsContextValue extends TimeStatsState, TimeStatsActions {
  timeStatsRef: MutableRefObject<TimeStatsState>;
  watchTimerRef: MutableRefObject<ReturnType<typeof setInterval> | null>;
}

// ============ AI ============

export interface AiActions {
  setSelectedText: (text: string) => void;
  setExplanation: (explanation: string) => void;
  setLoading: (loading: boolean) => void;
}

export interface AIContextValue extends AiState, AiActions {}

// ============ ApiKey ============

export interface ApiKeyActions {
  setApiKey: (apiKey: string) => void;
  setModelUrl: (modelUrl: string) => void;
  setShowInput: (show: boolean) => void;
  setStatus: (status: string) => void;
  setConfigSource: (source: ApiKeyState['configSource']) => void;
}

export interface ApiKeyContextValue extends ApiKeyState, ApiKeyActions {}

// ============ Error ============

export interface ErrorActions {
  setError: (error: unknown) => void;
  hideError: () => void;
  clearError: () => void;
}

export interface ErrorContextValue extends ErrorState, ErrorActions {}

// ============ Contexts ============

const VideoContext = createContext<VideoContextValue | undefined>(undefined);
const TimeStatsContext = createContext<TimeStatsContextValue | undefined>(undefined);
const AIContext = createContext<AIContextValue | undefined>(undefined);
const ApiKeyContext = createContext<ApiKeyContextValue | undefined>(undefined);
const ErrorContext = createContext<ErrorContextValue | undefined>(undefined);

// ============ Error reducer (inline) ============

const errorReducer = (state: ErrorState, action: ErrorAction): ErrorState => {
  switch (action.type) {
    case 'SET_ERROR':
      return { ...state, error: action.payload, showError: true };
    case 'HIDE_ERROR':
      return { ...state, showError: false };
    case 'CLEAR_ERROR':
      return { ...state, error: null, showError: false };
    default:
      return state;
  }
};

// ============ Hooks ============

export const useVideo = (): VideoContextValue => {
  const context = useContext(VideoContext);
  if (!context) {
    throw new Error('useVideo must be used within a VideoProvider');
  }
  return context;
};

export const useTimeStats = (): TimeStatsContextValue => {
  const context = useContext(TimeStatsContext);
  if (!context) {
    throw new Error('useTimeStats must be used within a TimeStatsProvider');
  }
  return context;
};

export const useAI = (): AIContextValue => {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAI must be used within a AIProvider');
  }
  return context;
};

export const useApiKey = (): ApiKeyContextValue => {
  const context = useContext(ApiKeyContext);
  if (!context) {
    throw new Error('useApiKey must be used within a ApiKeyProvider');
  }
  return context;
};

export const useError = (): ErrorContextValue => {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
};

// ============ Providers ============

interface ProviderProps {
  children: ReactNode;
}

export const ErrorProvider: React.FC<ProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(errorReducer, {
    error: null,
    showError: false
  });

  const actions: ErrorActions = {
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

export const VideoProvider: React.FC<ProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(videoReducer, {
    videoPath: null,
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    subtitleText: '',
    isLoaded: false
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<Player | null>(null);

  const actions = useMemo<VideoActions>(() => ({
    setVideoPath: (path) => dispatch({ type: 'SET_VIDEO_PATH', payload: path }),
    setCurrentTime: (time) => dispatch({ type: 'SET_CURRENT_TIME', payload: time }),
    setDuration: (duration) => dispatch({ type: 'SET_DURATION', payload: duration }),
    setIsPlaying: (isPlaying) => dispatch({ type: 'SET_IS_PLAYING', payload: isPlaying }),
    setSubtitleText: (text) => dispatch({ type: 'SET_SUBTITLE_TEXT', payload: text }),
    setVideoLoaded: (loaded) => dispatch({ type: 'SET_VIDEO_LOADED', payload: loaded }),
    setPlayer: (player) => {
      playerRef.current = player;
    },
    jumpToTime: (seconds) => {
      const p = playerRef.current as unknown as { currentTime?: (t?: number) => number } | null;
      if (p && typeof p.currentTime === 'function') {
        p.currentTime(seconds);
      } else if (videoRef.current && typeof videoRef.current.currentTime === 'number') {
        videoRef.current.currentTime = seconds;
      }
    }
  }), []);

  return (
    <VideoContext.Provider value={{ ...state, ...actions, videoRef, playerRef }}>
      {children}
    </VideoContext.Provider>
  );
};

export const TimeStatsProvider: React.FC<ProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(timeStatsReducer, {
    totalTime: 0,
    sessionTime: 0
  });

  const timeStatsRef = useRef<TimeStatsState>({ totalTime: 0, sessionTime: 0 });
  const watchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timeStatsRef.current = state;
  }, [state]);

  const actions: TimeStatsActions = {
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
    startWatchTimer: (videoPath, videoRef) => {
      if (watchTimerRef.current || !videoPath || !videoRef.current) return;

      watchTimerRef.current = setInterval(() => {
        if (!videoRef.current) {
          return;
        }
        const newTotal = timeStatsRef.current.totalTime + 60;
        const newSession = timeStatsRef.current.sessionTime + 60;
        const currentPosition = Math.floor(videoRef.current.currentTime);

        if (ipcClient.isAvailable()) {
          ipcClient.updateWatchTime({
            videoId: videoPath,
            deltaSeconds: 60,
            currentPosition
          });
        }

        dispatch({
          type: 'UPDATE_STATS',
          payload: { totalTime: newTotal, sessionTime: newSession }
        });
      }, 60000);
    },
    stopWatchTimer: () => {
      if (watchTimerRef.current) {
        clearInterval(watchTimerRef.current);
        watchTimerRef.current = null;
      }
    }
  };

  return (
    <TimeStatsContext.Provider value={{ ...state, ...actions, timeStatsRef, watchTimerRef }}>
      {children}
    </TimeStatsContext.Provider>
  );
};

export const AIProvider: React.FC<ProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(aiReducer, {
    selectedText: '',
    explanation: '',
    loading: false
  });

  const actions: AiActions = {
    setSelectedText: (text) => {
      dispatch({ type: 'SET_SELECTED_TEXT', payload: text });
    },
    setExplanation: (explanation) => {
      dispatch({ type: 'SET_EXPLANATION', payload: explanation });
    },
    setLoading: (loading) => {
      dispatch({ type: 'SET_LOADING', payload: loading });
    }
  };

  return (
    <AIContext.Provider value={{ ...state, ...actions }}>
      {children}
    </AIContext.Provider>
  );
};

export const ApiKeyProvider: React.FC<ProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(apiKeyReducer, {
    apiKey: '',
    modelUrl: 'https://api.stepfun.com/v1/chat/completions',
    showInput: false,
    status: '正在加载...',
    configSource: { apiKey: 'default', modelUrl: 'default' }
  } as ApiKeyState);

  const actions: ApiKeyActions = {
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

// Silence unused warning for Dispatch (kept for potential external consumers)
export type AnyDispatch = Dispatch<unknown>;
