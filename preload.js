// preload.js
// 预加载脚本，将Node.js API暴露给渲染进程

console.log('--- Preload script: START ---');
// 仅引入 Electron IPC
const { contextBridge, ipcRenderer } = require('electron');

// 白名单，列出允许渲染进程调用的IPC通道
const allowedInvokeChannels = [
  'readVideoFile',           // 新增：读取视频文件二进制数据
  'readVideoChunk',          // 新增：分段读取文件
  'performAIRequest',        // 新增：AI 请求通过主进程发起，避免 CORS
  'performAIStream',         // 新增：AI 流式请求
  'extract-frame',
  'selectSubtitle',
  'selectVideo',
  'getWatchTime',
  'saveLearningRecord',
  'saveAiQuery',
  'getCachedAiQuery',
  'getLearningRecords',
  'getAiQueriesToday',
  'saveApiKey',
  'getApiKey',
  'install-update',          // 新增：用于触发更新安装
  'saveQueryHistory',        // 新增：用于保存查询历史
  'getVideoServerPort',
  'prepareVideo',
  'cleanupVideoCache',       // 添加新的通道
  'checkFileExists',         // 添加：检查文件是否存在
  'checkDatabaseStatus',     // 添加：检查数据库状态
  'lookupWord',             // 添加：字典查询通道
  'export-learning-today-pdf', // 添加：导出PDF通道
  // 学习Agent相关
  'getLearningOverview',
  'analyzeLearningPattern',
  'getLearningReport',
  'getWordFrequencyStats',
  'saveStudyPlan',
  'getCurrentStudyPlan',
  'updatePlanProgress',
  'getWordsToReview',
  'getVocabularyCard',
  'updateVocabularyCard',
  'addVocabularyWord',
  'extractWordsFromQueries',
  'getVocabularyStats',
  // T1-6: highlights IPC channels
  'createHighlight',
  'getHighlights',
  'getHighlight',
  'updateHighlight',
  'deleteHighlight',
  'getDueHighlights',
  'submitReview',
  'getHighlightsStats',
];

const allowedSendChannels = [
  'getCategories',
  'getMovies',
  'updateWatchTime',
  'loadSubtitle',
  'deleteLearningRecord', // 新增：删除学习记录
  'getLearningStats',     // 新增：获取学习统计
  'getWatchingStats'      // 新增：获取观看统计
];

const allowedReceiveChannels = [
  'categories',
  'movies',
  'watchTime',
  'error',
  'databaseInitError',
  'learningRecords',
  'subtitleLoaded',
  'videoSelectedFromMenu',
  'openApiKeySettings',
  'update-available',     // 新增：更新可用通知
  'update-downloaded',    // 新增：更新已下载通知
  'watchTimeUpdated',     // 新增：观看时间更新通知
  'learningRecordDeleted', // 新增：学习记录删除通知
  'learningStats',        // 新增：学习统计信息
  'watchingStats',        // 新增：观看统计信息
  'databaseStatus',       // 新增：数据库状态
  'ai-stream',            // 新增：AI 流式事件
  'conversion-progress',  // 新增：视频转换进度
  'conversion-complete'   // 新增：视频转换完成
];

// 请求频率限制
const rateLimits = new Map();
const RATE_LIMIT_WINDOW = 1000; // 1秒内的请求限制
const RATE_LIMIT_MAX = 5; // 每秒最大请求次数

// 检查速率限制
function checkRateLimit(channel) {
  const now = Date.now();
  const channelLimits = rateLimits.get(channel) || [];
  
  // 清理过期的记录
  const validLimits = channelLimits.filter(time => now - time < RATE_LIMIT_WINDOW);
  
  // 如果超过限制，返回true
  if (validLimits.length >= RATE_LIMIT_MAX) {
    return true;
  }
  
  // 添加新的请求时间戳
  validLimits.push(now);
  rateLimits.set(channel, validLimits);
  return false;
}

// 使用 contextBridge 暴露 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 调用主进程函数 (通常用于请求数据或执行操作)
  invoke: async (channel, ...args) => {
    if (allowedInvokeChannels.includes(channel)) {
      try {
        if (checkRateLimit(channel)) {
          console.warn(`【Preload】通道被限流: ${channel}`);
          throw new Error(`Rate limit exceeded for channel: ${channel}`);
        }
        console.log(`【Preload】调用 invoke 通道: ${channel}`, args);
        const result = await ipcRenderer.invoke(channel, ...args);
        return result;
      } catch (error) {
        console.error(`【Preload】invoke 调用失败: ${channel}`, error);
        // 确保错误信息被正确传递
        if (error instanceof Error) {
          throw {
            message: error.message,
            stack: error.stack,
            code: error.code || 'UNKNOWN_ERROR'
          };
        } else if (typeof error === 'object') {
          throw {
            message: error.message || '未知错误',
            code: error.code || 'UNKNOWN_ERROR',
            details: error
          };
        } else {
          throw {
            message: String(error),
            code: 'UNKNOWN_ERROR'
          };
        }
      }
    }
    console.error(`【Preload】阻止调用未授权的 invoke 通道: ${channel}`);
    throw new Error(`Unauthorized invoke channel: ${channel}`);
  },
  
  // 发送消息到主进程 (通常用于触发事件，不一定期望直接返回值)
  send: (channel, ...args) => {
    if (allowedSendChannels.includes(channel)) {
      try {
        if (checkRateLimit(channel)) {
          console.warn(`【Preload】通道被限流: ${channel}`);
          throw new Error(`Rate limit exceeded for channel: ${channel}`);
        }
        console.log(`【Preload】发送到 send 通道: ${channel}`, args);
        ipcRenderer.send(channel, ...args);
      } catch (error) {
        console.error(`【Preload】send 发送失败: ${channel}`, error);
      }
    } else {
      console.error(`【Preload】阻止发送到未授权的 send 通道: ${channel}`);
    }
  },
  
  // 监听来自主进程的消息
  on: (channel, listener) => {
    if (allowedReceiveChannels.includes(channel)) {
      // 使用唯一的包装函数来避免重复注册问题
      const wrappedListener = (event, ...args) => {
        console.log(`【Preload】收到IPC消息: ${channel}`, args);
        listener(...args);
      };
      
      // 存储包装函数的引用，以便后续可以移除
      ipcRenderer.on(channel, wrappedListener);
      
      // 返回清理函数
      return () => {
        ipcRenderer.removeListener(channel, wrappedListener);
      };
    } else {
      console.error(`【Preload】阻止监听未授权的 receive 通道: ${channel}`);
      return () => {}; 
    }
  },
  
  // 移除特定监听器
  removeListener: (channel, listener) => {
     if (allowedReceiveChannels.includes(channel)) {
       ipcRenderer.removeListener(channel, listener);
     } else {
        console.error(`【Preload】尝试移除未授权通道的监听器: ${channel}`);
     }
  },
  
  // 移除某个通道的所有监听器
  removeAllListeners: (channel) => {
     if (allowedReceiveChannels.includes(channel)) {
       ipcRenderer.removeAllListeners(channel);
     } else {
        console.error(`【Preload】尝试移除未授权通道的所有监听器: ${channel}`);
     }
  },

  // API Key相关
  saveApiKey: ({ apiKey, modelUrl }) => ipcRenderer.invoke('saveApiKey', { apiKey, modelUrl }),
  getApiKey: () => ipcRenderer.invoke('getApiKey'),
  
  // ============== 具体功能 API (简化) ============== 
  
  // 帧提取相关
  extractFrame: (videoPath, timestamp) => ipcRenderer.invoke('extract-frame', { videoPath, timestamp }),
  
  // 文件/目录相关
  selectVideo: () => ipcRenderer.invoke('selectVideo'),
  selectSubtitle: (videoPath) => ipcRenderer.invoke('selectSubtitle', { videoPath }),
  
  // 数据库相关
  getCategories: () => ipcRenderer.send('getCategories'),
  getMovies: (category_id, page) => ipcRenderer.send('getMovies', { category_id, page }),
  getWatchTime: (videoId) => {
    if (checkRateLimit('getWatchTime')) {
      throw new Error('Rate limit exceeded for channel: getWatchTime');
    }
    return ipcRenderer.invoke('getWatchTime', { videoId });
  },
  updateWatchTime: (watchTimeData) => ipcRenderer.send('updateWatchTime', watchTimeData),
  saveLearningRecord: (record) => ipcRenderer.invoke('saveLearningRecord', record),
  saveAiQuery: (data) => ipcRenderer.invoke('saveAiQuery', data),
  getCachedAiQuery: (payload) => ipcRenderer.invoke('getCachedAiQuery', payload),
  getAiQueriesToday: () => ipcRenderer.invoke('getAiQueriesToday'),
  getLearningRecords: (videoId) => ipcRenderer.invoke('getLearningRecords', { videoId }),
  
  // 系统信息
  platform: process.platform,
  
  // AI 请求
  performAIRequest: (requestData, apiUrl, apiKey) => ipcRenderer.invoke('performAIRequest', { requestData, apiUrl, apiKey }),
  performAIStream: (requestData, apiUrl, apiKey) => ipcRenderer.invoke('performAIStream', { requestData, apiUrl, apiKey }),
  
  // 读取视频文件数据
  readVideoFile: (filePath) => ipcRenderer.invoke('readVideoFile', filePath),
  // 新增：分段读取视频文件
  readVideoChunk: (videoPath, offset, length) => ipcRenderer.invoke('readVideoChunk', videoPath, offset, length),
  
  // 获取本地视频 HTTP 服务端口
  getVideoServerPort: () => ipcRenderer.invoke('getVideoServerPort'),
  // 生成本地视频 HTTP URL
  getVideoHttpUrl: async (videoPath) => {
    const port = await ipcRenderer.invoke('getVideoServerPort');
    if (!port) {
      throw new Error('视频服务端口不可用，无法生成播放地址');
    }
    return `http://127.0.0.1:${port}/video?path=${encodeURIComponent(videoPath)}`;
  },
  
  // 视频格式预处理：将 mkv/avi 转换为 mp4
  prepareVideo: (filePath) => ipcRenderer.invoke('prepareVideo', filePath),
  
  // 视频格式转换相关
  convertVideo: (params) => ipcRenderer.invoke('convertVideo', params),
  checkVideoFormat: (filePath) => ipcRenderer.invoke('checkVideoFormat', filePath),
  
  // 清理视频缓存
  cleanupVideoCache: () => ipcRenderer.invoke('cleanupVideoCache'),
  // 检查文件是否存在
  checkFileExists: (filePath) => ipcRenderer.invoke('checkFileExists', filePath),
  
  // 字典查询
  lookupWord: (word) => ipcRenderer.invoke('lookupWord', word),
  
  // ============== 学习Agent相关API ==============
  // 学习分析
  getLearningOverview: () => ipcRenderer.invoke('getLearningOverview'),
  analyzeLearningPattern: () => ipcRenderer.invoke('analyzeLearningPattern'),
  getLearningReport: (options) => ipcRenderer.invoke('getLearningReport', options),
  getWordFrequencyStats: (options) => ipcRenderer.invoke('getWordFrequencyStats', options),
  
  // 学习计划
  saveStudyPlan: (data) => ipcRenderer.invoke('saveStudyPlan', data),
  getCurrentStudyPlan: () => ipcRenderer.invoke('getCurrentStudyPlan'),
  updatePlanProgress: (progress) => ipcRenderer.invoke('updatePlanProgress', progress),
  
  // 背单词（间隔重复）
  getWordsToReview: (options) => ipcRenderer.invoke('getWordsToReview', options),
  getVocabularyCard: (data) => ipcRenderer.invoke('getVocabularyCard', data),
  updateVocabularyCard: (data) => ipcRenderer.invoke('updateVocabularyCard', data),
  addVocabularyWord: (data) => ipcRenderer.invoke('addVocabularyWord', data),
  extractWordsFromQueries: (options) => ipcRenderer.invoke('extractWordsFromQueries', options),
  getVocabularyStats: () => ipcRenderer.invoke('getVocabularyStats'),

  // ===== T1-6: highlights IPC channels =====
  // CRUD
  createHighlight: (highlightData) => ipcRenderer.invoke('createHighlight', highlightData),
  getHighlights: (params) => ipcRenderer.invoke('getHighlights', params),
  getHighlight: (params) => ipcRenderer.invoke('getHighlight', params),
  updateHighlight: (params) => ipcRenderer.invoke('updateHighlight', params),
  deleteHighlight: (params) => ipcRenderer.invoke('deleteHighlight', params),
  // SRS
  getDueHighlights: (params) => ipcRenderer.invoke('getDueHighlights', params),
  submitReview: (params) => ipcRenderer.invoke('submitReview', params),
  // Stats
  getHighlightsStats: () => ipcRenderer.invoke('getHighlightsStats')
});

console.log('--- Preload script: END ---'); 
