/**
 * IPC client wrapper for renderer process.
 * All IPC channel names are centralized here to avoid string literals in callers.
 *
 * Channel definitions:
 * - invoke: request/response channels
 * - send: fire-and-forget channels
 * - receive: event channels pushed from main process
 */
export const IPC_CHANNELS = {
  invoke: {
    readVideoFile: 'readVideoFile',
    readVideoChunk: 'readVideoChunk',
    performAIRequest: 'performAIRequest',
    performAIStream: 'performAIStream',
    extractFrame: 'extract-frame',
    selectSubtitle: 'selectSubtitle',
    selectVideo: 'selectVideo',
    getWatchTime: 'getWatchTime',
    saveLearningRecord: 'saveLearningRecord',
    saveAiQuery: 'saveAiQuery',
    getCachedAiQuery: 'getCachedAiQuery',
    getLearningRecords: 'getLearningRecords',
    getAiQueriesToday: 'getAiQueriesToday',
    saveApiKey: 'saveApiKey',
    getApiKey: 'getApiKey',
    checkDatabaseStatus: 'checkDatabaseStatus',
    exportLearningTodayPdf: 'export-learning-today-pdf',
    getVideoServerPort: 'getVideoServerPort',
    prepareVideo: 'prepareVideo',
    cleanupVideoCache: 'cleanupVideoCache',
    checkFileExists: 'checkFileExists',
    lookupWord: 'lookupWord',
    convertVideo: 'convertVideo',
    checkVideoFormat: 'checkVideoFormat',
    getLearningOverview: 'getLearningOverview',
    analyzeLearningPattern: 'analyzeLearningPattern',
    getLearningReport: 'getLearningReport',
    getWordFrequencyStats: 'getWordFrequencyStats',
    saveStudyPlan: 'saveStudyPlan',
    getCurrentStudyPlan: 'getCurrentStudyPlan',
    updatePlanProgress: 'updatePlanProgress',
    getWordsToReview: 'getWordsToReview',
    getVocabularyCard: 'getVocabularyCard',
    updateVocabularyCard: 'updateVocabularyCard',
    addVocabularyWord: 'addVocabularyWord',
    extractWordsFromQueries: 'extractWordsFromQueries',
    getVocabularyStats: 'getVocabularyStats'
  },
  send: {
    getCategories: 'getCategories',
    getMovies: 'getMovies',
    updateWatchTime: 'updateWatchTime',
    loadSubtitle: 'loadSubtitle'
  },
  receive: {
    categories: 'categories',
    movies: 'movies',
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
    watchingStats: 'watchingStats',
    databaseStatus: 'databaseStatus',
    aiStream: 'ai-stream',
    conversionProgress: 'conversion-progress',
    conversionComplete: 'conversion-complete'
  }
};

const getElectronAPI = () => {
  if (typeof window === 'undefined' || !window.electronAPI) {
    return null;
  }
  return window.electronAPI;
};

const createUnavailableError = () => new Error('Electron API不可用');

const invoke = async (channel, ...args) => {
  const api = getElectronAPI();
  if (!api?.invoke) {
    throw createUnavailableError();
  }
  return api.invoke(channel, ...args);
};

const send = (channel, ...args) => {
  const api = getElectronAPI();
  if (!api?.send) {
    console.error('Electron API不可用，无法发送IPC消息');
    return;
  }
  api.send(channel, ...args);
};

const on = (channel, listener) => {
  const api = getElectronAPI();
  if (!api?.on) {
    console.error('Electron API不可用，无法监听IPC事件');
    return () => {};
  }
  return api.on(channel, listener);
};

const removeAllListeners = (channel) => {
  const api = getElectronAPI();
  if (!api?.removeAllListeners) {
    return;
  }
  api.removeAllListeners(channel);
};

export const ipcClient = {
  isAvailable: () => Boolean(getElectronAPI()),
  onVideoSelectedFromMenu: (listener) => on(IPC_CHANNELS.receive.videoSelectedFromMenu, listener),
  onSubtitleLoaded: (listener) => on(IPC_CHANNELS.receive.subtitleLoaded, listener),
  onOpenApiKeySettings: (listener) => on(IPC_CHANNELS.receive.openApiKeySettings, listener),
  onAiStream: (listener) => on(IPC_CHANNELS.receive.aiStream, listener),
  onConversionProgress: (listener) => on(IPC_CHANNELS.receive.conversionProgress, listener),
  onConversionComplete: (listener) => on(IPC_CHANNELS.receive.conversionComplete, listener),
  removeAllListeners: (channel) => removeAllListeners(channel),

  selectVideo: () => invoke(IPC_CHANNELS.invoke.selectVideo),
  selectSubtitle: (videoPath) => invoke(IPC_CHANNELS.invoke.selectSubtitle, { videoPath }),
  extractFrame: (videoPath, timestamp) => invoke(IPC_CHANNELS.invoke.extractFrame, { videoPath, timestamp }),
  saveLearningRecord: (record) => invoke(IPC_CHANNELS.invoke.saveLearningRecord, record),
  getLearningRecords: (videoId) => invoke(IPC_CHANNELS.invoke.getLearningRecords, { videoId }),
  getWatchTime: (videoId) => {
    const api = getElectronAPI();
    if (api?.getWatchTime) {
      return api.getWatchTime(videoId);
    }
    return invoke(IPC_CHANNELS.invoke.getWatchTime, { videoId });
  },
  updateWatchTime: (watchTimeData) => send(IPC_CHANNELS.send.updateWatchTime, watchTimeData),
  loadSubtitle: (subtitlePath) => send(IPC_CHANNELS.send.loadSubtitle, { subtitlePath }),
  getCategories: () => send(IPC_CHANNELS.send.getCategories),
  getMovies: (category_id, page) => send(IPC_CHANNELS.send.getMovies, { category_id, page }),
  checkFileExists: (filePath) => invoke(IPC_CHANNELS.invoke.checkFileExists, filePath),

  saveAiQuery: (data) => invoke(IPC_CHANNELS.invoke.saveAiQuery, data),
  getCachedAiQuery: (payload) => invoke(IPC_CHANNELS.invoke.getCachedAiQuery, payload),
  getAiQueriesToday: () => invoke(IPC_CHANNELS.invoke.getAiQueriesToday),

  performAIRequest: (requestData, apiUrl, apiKey) =>
    invoke(IPC_CHANNELS.invoke.performAIRequest, { requestData, apiUrl, apiKey }),
  performAIStream: (requestData, apiUrl, apiKey) =>
    invoke(IPC_CHANNELS.invoke.performAIStream, { requestData, apiUrl, apiKey }),

  getApiKey: () => invoke(IPC_CHANNELS.invoke.getApiKey),
  saveApiKey: (payload) => invoke(IPC_CHANNELS.invoke.saveApiKey, payload),

  checkDatabaseStatus: () => invoke(IPC_CHANNELS.invoke.checkDatabaseStatus),
  exportLearningTodayPdf: (payload) => invoke(IPC_CHANNELS.invoke.exportLearningTodayPdf, payload),

  readVideoFile: (filePath) => invoke(IPC_CHANNELS.invoke.readVideoFile, filePath),
  readVideoChunk: (videoPath, offset, length) =>
    invoke(IPC_CHANNELS.invoke.readVideoChunk, videoPath, offset, length),
  getVideoServerPort: () => {
    const api = getElectronAPI();
    if (api?.getVideoServerPort) {
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
  convertVideo: (params) => invoke(IPC_CHANNELS.invoke.convertVideo, params),
  checkVideoFormat: (filePath) => invoke(IPC_CHANNELS.invoke.checkVideoFormat, filePath),
  cleanupVideoCache: () => invoke(IPC_CHANNELS.invoke.cleanupVideoCache),

  lookupWord: (word) => invoke(IPC_CHANNELS.invoke.lookupWord, word),

  getLearningOverview: () => invoke(IPC_CHANNELS.invoke.getLearningOverview),
  analyzeLearningPattern: () => invoke(IPC_CHANNELS.invoke.analyzeLearningPattern),
  getLearningReport: (options) => invoke(IPC_CHANNELS.invoke.getLearningReport, options),
  getWordFrequencyStats: (options) => invoke(IPC_CHANNELS.invoke.getWordFrequencyStats, options),

  saveStudyPlan: (data) => invoke(IPC_CHANNELS.invoke.saveStudyPlan, data),
  getCurrentStudyPlan: () => invoke(IPC_CHANNELS.invoke.getCurrentStudyPlan),
  updatePlanProgress: (progress) => invoke(IPC_CHANNELS.invoke.updatePlanProgress, progress),

  getWordsToReview: (options) => invoke(IPC_CHANNELS.invoke.getWordsToReview, options),
  getVocabularyCard: (data) => invoke(IPC_CHANNELS.invoke.getVocabularyCard, data),
  updateVocabularyCard: (data) => invoke(IPC_CHANNELS.invoke.updateVocabularyCard, data),
  addVocabularyWord: (data) => invoke(IPC_CHANNELS.invoke.addVocabularyWord, data),
  extractWordsFromQueries: (options) => invoke(IPC_CHANNELS.invoke.extractWordsFromQueries, options),
  getVocabularyStats: () => invoke(IPC_CHANNELS.invoke.getVocabularyStats)
};

export default ipcClient;
