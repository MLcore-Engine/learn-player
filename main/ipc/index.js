const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseSync } = require('subtitle');
const { extractFrame, cleanupTempFile } = require('../videoFrameExtractor');
const { ffmpeg } = require('../media/ffmpeg');
const { getVideoServerPort, startVideoServer } = require('../services/videoServer');

const algorithm = 'aes-256-cbc';
const encryptionSecret = crypto.createHash('sha256').update('lep-very-secret-key-replace-me').digest('base64').substring(0, 32);
// IV 必须是 16 字节
const iv = Buffer.from('lepinitialvector', 'utf8'); // 固定 IV 也是不推荐的，但简化了演示
const DEFAULT_AI_MODEL_URL = 'https://api.stepfun.com/v1/chat/completions';
const LEGACY_AI_MODEL_URLS = new Set([
  'https://open.bigmodel.cn/api/paas/v4/chat/completions'
]);

// 加密函数
function encrypt(text) {
  try {
    const cipher = crypto.createCipheriv(algorithm, Buffer.from(encryptionSecret), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  } catch (error) {
    console.error('加密失败:', error);
    return null;
  }
}

// 解密函数
function decrypt(encryptedHex) {
  try {
    const decipher = crypto.createDecipheriv(algorithm, Buffer.from(encryptionSecret), iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('解密失败:', error);
    return null;
  }
}

function getEnvValue(keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function normalizeModelUrl(rawUrl) {
  const url = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  if (!url) return '';

  if (LEGACY_AI_MODEL_URLS.has(url)) {
    return DEFAULT_AI_MODEL_URL;
  }

  try {
    const parsed = new URL(url);
    if (/(^|\.)bigmodel\.cn$/.test(parsed.hostname)) {
      return DEFAULT_AI_MODEL_URL;
    }
  } catch (_) {}

  return url;
}

function resolveAiConfig(store) {
  const encryptedApiKey = store.get('encryptedApiKey');
  let storedApiKey = null;
  if (encryptedApiKey) {
    const decryptedApiKey = decrypt(encryptedApiKey);
    if (decryptedApiKey !== null) {
      storedApiKey = decryptedApiKey;
    } else {
      console.error('【主进程】解密 API Key 失败');
      store.delete('encryptedApiKey');
    }
  }

  const storedModelUrlRaw = store.get('modelUrl');
  const storedModelUrl = normalizeModelUrl(storedModelUrlRaw);
  if (typeof storedModelUrlRaw === 'string' && storedModelUrlRaw.trim() && storedModelUrl !== storedModelUrlRaw.trim()) {
    store.set('modelUrl', storedModelUrl);
    console.warn('【主进程】检测到旧模型 URL，已自动迁移到 StepFun 默认地址');
  }
  const envApiKey = getEnvValue(['AI_API_KEY', 'STEP_API_KEY', 'REACT_APP_STEP_API_KEY']);
  const envModelUrl = normalizeModelUrl(getEnvValue(['AI_MODEL_URL', 'STEP_API_URL', 'REACT_APP_STEP_API_URL']));

  const apiKeySource = storedApiKey ? 'store' : envApiKey ? 'env' : 'default';
  const modelUrlSource = storedModelUrl ? 'store' : envModelUrl ? 'env' : 'default';

  if (apiKeySource === 'env' || modelUrlSource === 'env') {
    console.warn('【主进程】正在使用环境变量中的 AI 配置，请在设置中保存以避免生产环境误用');
  }

  return {
    apiKey: storedApiKey || envApiKey || null,
    modelUrl: storedModelUrl || envModelUrl || DEFAULT_AI_MODEL_URL,
    source: {
      apiKey: apiKeySource,
      modelUrl: modelUrlSource
    }
  };
}

// 缓存管理配置
const CACHE_CONFIG = {
  maxSize: 1024 * 1024 * 1024, // 1GB 缓存限制
  cleanupInterval: 24 * 60 * 60 * 1000, // 24小时清理一次
  tmpDir: path.join(os.tmpdir(), 'converted-videos')
};

// 缓存管理函数
async function cleanupCache() {
  try {
    if (!fs.existsSync(CACHE_CONFIG.tmpDir)) return;

    const files = await fs.promises.readdir(CACHE_CONFIG.tmpDir);
    let totalSize = 0;
    const fileStats = [];

    // 获取所有文件信息
    for (const file of files) {
      const filePath = path.join(CACHE_CONFIG.tmpDir, file);
      const stats = await fs.promises.stat(filePath);
      totalSize += stats.size;
      fileStats.push({
        path: filePath,
        size: stats.size,
        mtime: stats.mtime
      });
    }

    // 如果总大小超过限制，按最后修改时间排序并删除最旧的文件
    if (totalSize > CACHE_CONFIG.maxSize) {
      fileStats.sort((a, b) => a.mtime - b.mtime);
      let currentSize = totalSize;

      for (const file of fileStats) {
        if (currentSize <= CACHE_CONFIG.maxSize) break;
        await fs.promises.unlink(file.path);
        currentSize -= file.size;
        console.log(`清理缓存文件: ${file.path}`);
      }
    }
  } catch (error) {
    console.error('清理缓存失败:', error);
  }
}

// 添加字典文件路径
const DICT_PATH = path.join(__dirname, '..', '..', 'resources', 'dictionary', '美国传统词典双解.mdx');

// 添加字典实例缓存
let dictInstance = null;

// 检查字典文件是否存在
function checkDictionaryFile() {
  try {
    if (!fs.existsSync(DICT_PATH)) {
      console.error('字典文件不存在:', DICT_PATH);
      return false;
    }
    return true;
  } catch (error) {
    console.error('检查字典文件失败:', error);
    return false;
  }
}

// 获取字典实例
function getDictionaryInstance() {
  if (!dictInstance) {
    const { MDX } = require('js-mdict');
    dictInstance = new MDX(DICT_PATH);
  }
  return dictInstance;
}

function registerIpcHandlers({ app, ipcMain, dialog, BrowserWindow, store, state, autoUpdater }) {
  const getMainWindow = () => state.mainWindow;
  const getDb = () => state.db;
  const getLastVideoDir = () => store.get('lastVideoDir') || app.getPath('videos');

  // 定期清理缓存
  setInterval(cleanupCache, CACHE_CONFIG.cleanupInterval);

  ipcMain.handle('saveApiKey', (event, payload) => {
    console.log('【主进程】收到 saveApiKey 请求');
    try {
      const { apiKey, modelUrl } = typeof payload === 'string' ? { apiKey: payload } : (payload || {});
      // 保存 Model URL（支持清空重置）
      if (typeof modelUrl === 'string') {
        const normalizedModelUrl = normalizeModelUrl(modelUrl);
        if (normalizedModelUrl) {
          store.set('modelUrl', normalizedModelUrl);
          console.log('【主进程】Model URL 已保存');
        } else {
          store.delete('modelUrl');
          console.log('【主进程】Model URL 已清除，将回退到默认值');
        }
      }

      // 处理 API Key
      if (!apiKey) {
        console.log('【主进程】API Key 为空，清除存储');
        store.delete('encryptedApiKey');
        return { success: true, message: 'API Key 已清除' };
      }

      const encryptedApiKey = encrypt(apiKey);
      if (encryptedApiKey) {
        store.set('encryptedApiKey', encryptedApiKey);
        console.log('【主进程】加密后的 API Key 已保存');
        return { success: true };
      } else {
        console.error('【主进程】加密 API Key 失败');
        return { success: false, error: '加密失败' };
      }
    } catch (error) {
      console.error('【主进程】保存 API Key 时出错:', error);
      return { success: false, error: error.message };
    }
  });

  // 获取 API Key
  ipcMain.handle('getApiKey', (event) => {
    console.log('【主进程】收到 getApiKey 请求');
    try {
      const resolved = resolveAiConfig(store);
      if (resolved.apiKey) {
        console.log('【主进程】成功返回 API Key');
      } else {
        console.log('【主进程】未找到可用的 API Key');
      }
      return { success: true, apiKey: resolved.apiKey, modelUrl: resolved.modelUrl, source: resolved.source };
    } catch (error) {
      console.error('【主进程】获取 API Key 时出错:', error);
      return { success: false, error: error.message };
    }
  });

  // IPC: 获取视频服务器端口
  // 服务未就绪时返回 null，让渲染进程稍后重试。
  ipcMain.handle('getVideoServerPort', () => {
    const port = getVideoServerPort();
    if (!port) {
      startVideoServer();
      return null;
    }
    return port;
  });

  // 选择视频文件
  ipcMain.handle('selectVideo', async (event) => {
    console.log('【主进程】收到selectVideo请求');
    try {
      const result = await dialog.showOpenDialog(getMainWindow(), {
        defaultPath: getLastVideoDir(),
        properties: ['openFile'],
        filters: [
          { name: '视频文件', extensions: ['mp4', 'mkv', 'avi', 'mov'] }
        ]
      });

      console.log('文件选择结果:', result);

      if (!result.canceled && result.filePaths.length > 0) {
        const videoPath = result.filePaths[0];
        store.set('lastVideoDir', path.dirname(videoPath));
        const videoName = path.basename(videoPath);
        const subtitlePath = null; // 不再自动查找字幕，手动加载
        return {
          success: true,
          path: videoPath,
          name: videoName,
          subtitlePath: subtitlePath
        };
      } else {
        return { success: false, canceled: true };
      }
    } catch (error) {
      console.error('文件选择对话框出错:', error);
      return { success: false, error: error.message };
    }
  });

  // 选择字幕文件
  ipcMain.handle('selectSubtitle', async (event, { videoPath }) => {
    console.log('【主进程】收到selectSubtitle请求');
    try {
      const defaultDir = videoPath ? path.dirname(videoPath) : getLastVideoDir();

      const result = await dialog.showOpenDialog(getMainWindow(), {
        defaultPath: defaultDir,
        properties: ['openFile'],
        filters: [
          { name: '字幕文件', extensions: ['srt', 'vtt', 'ass', 'ssa'] }
        ]
      });

      console.log('字幕文件选择结果:', result);

      if (!result.canceled && result.filePaths.length > 0) {
        const subtitlePath = result.filePaths[0];
        return {
          success: true,
          path: subtitlePath
        };
      } else {
        return { success: false, canceled: true };
      }
    } catch (error) {
      console.error('字幕文件选择对话框出错:', error);
      return { success: false, error: error.message };
    }
  });

  // 加载字幕文件
  ipcMain.on('loadSubtitle', (event, { subtitlePath }) => {
    console.log('【主进程】收到 loadSubtitle 请求，手动加载字幕:', subtitlePath);
    const mainWindow = getMainWindow();
    if (!subtitlePath || !fs.existsSync(subtitlePath)) {
      console.log('【主进程】无效的字幕路径:', subtitlePath);
      mainWindow.webContents.send('subtitleLoaded', {
        success: false,
        error: '请手动选择有效的字幕文件'
      });
      return;
    }
    try {
      const subtitleContent = fs.readFileSync(subtitlePath, 'utf8');
      const parsedSubtitles = parseSync(subtitleContent);
      console.log(`【主进程】成功解析字幕文件: ${subtitlePath}, 共 ${parsedSubtitles.length} 条`);
      mainWindow.webContents.send('subtitleLoaded', {
        success: true,
        subtitles: parsedSubtitles
      });
    } catch (error) {
      console.error(`【主进程】解析字幕文件失败: ${subtitlePath}`, error);
      mainWindow.webContents.send('subtitleLoaded', {
        success: false,
        error: `解析字幕失败: ${error.message}`
      });
    }
  });

  // 更新时长统计
  ipcMain.on('updateWatchTime', (event, payload) => {
    const { videoId, deltaSeconds, totalTime, sessionTime, currentPosition } = payload || {};
    console.log('【主进程】收到updateWatchTime请求:', { videoId, deltaSeconds, totalTime, sessionTime, currentPosition });
    const db = getDb();
    const mainWindow = getMainWindow();
    if (!db) {
      console.error('数据库未初始化，无法更新观看时长');
      mainWindow.webContents.send('watchTimeUpdated', { success: false, error: '数据库未初始化' });
      return;
    }

    try {
      // 使用事务确保数据一致性
      db.transaction(() => {
        const now = new Date().toISOString();
        const today = now.slice(0, 10);

        // 确保 global_usage 行存在
        let gu = db.prepare('SELECT total_time FROM global_usage WHERE id = 1').get();
        if (!gu) {
          db.prepare('INSERT INTO global_usage(id, total_time, created_at, updated_at) VALUES(1, 0, ?, ?)')
            .run(now, now);
          gu = { total_time: 0 };
        }

        // 计算有效增量：优先使用 deltaSeconds；否则用 absolute 与库中差值的非负部分
        let effDelta = 0;
        if (typeof deltaSeconds === 'number' && deltaSeconds > 0) {
          effDelta = deltaSeconds;
        } else if (typeof totalTime === 'number') {
          effDelta = Math.max(0, totalTime - (gu.total_time || 0));
        }

        // 更新全局累计总观看时长（累加）
        db.prepare('UPDATE global_usage SET total_time = total_time + ?, updated_at = ? WHERE id = 1')
          .run(effDelta, now);

        // 处理当日会话时长（累加）
        let du = db.prepare('SELECT session_time FROM daily_usage WHERE date = ?').get(today);
        if (!du) {
          db.prepare('INSERT INTO daily_usage(date, session_time, created_at, updated_at) VALUES(?, 0, ?, ?)')
            .run(today, now, now);
          du = { session_time: 0 };
        }
        let dailyDelta = 0;
        if (typeof deltaSeconds === 'number' && deltaSeconds > 0) {
          dailyDelta = deltaSeconds;
        } else if (typeof sessionTime === 'number') {
          dailyDelta = Math.max(0, sessionTime - (du.session_time || 0));
        }
        db.prepare('UPDATE daily_usage SET session_time = session_time + ?, updated_at = ? WHERE date = ?')
          .run(dailyDelta, now, today);

        // 更新单视频播放进度
        if (videoId) {
          const vp = db.prepare('SELECT last_position FROM video_progress WHERE video_id = ?').get(videoId);
          if (vp) {
            db.prepare('UPDATE video_progress SET last_position = ?, last_watched = ?, updated_at = ? WHERE video_id = ?')
              .run(typeof currentPosition === 'number' ? currentPosition : vp.last_position, now, now, videoId);
          } else {
            db.prepare('INSERT INTO video_progress(video_id, last_position, last_watched, created_at, updated_at) VALUES(?, ?, ?, ?, ?)')
              .run(videoId, typeof currentPosition === 'number' ? currentPosition : 0, now, now, now);
          }
        }
      })();

      // 发送成功响应（返回当前库内值）
      try {
        const today = new Date().toISOString().slice(0, 10);
        const gu2 = db.prepare('SELECT total_time FROM global_usage WHERE id = 1').get();
        const du2 = db.prepare('SELECT session_time FROM daily_usage WHERE date = ?').get(today);
        mainWindow.webContents.send('watchTimeUpdated', {
          success: true,
          data: {
            totalTime: gu2?.total_time || 0,
            sessionTime: du2?.session_time || 0,
            currentPosition
          }
        });
      } catch (_) {}
    } catch (error) {
      console.error('【主进程】更新观看时长失败:', error);
      mainWindow.webContents.send('watchTimeUpdated', {
        success: false,
        error: error.message
      });
    }
  });

  // 获取视频的观看时长记录
  ipcMain.handle('getWatchTime', (event, { videoId }) => {
    console.log('【主进程】收到getWatchTime请求:', { videoId });
    const db = getDb();
    if (!db) return { totalTime: 0, sessionTime: 0, lastPosition: 0 };

    const today = new Date().toISOString().slice(0, 10);
    // 全局累计
    const gu = db.prepare('SELECT total_time FROM global_usage WHERE id = 1').get();
    const totalTime = gu ? gu.total_time : 0;
    // 当日会话
    const du = db.prepare('SELECT session_time FROM daily_usage WHERE date = ?').get(today);
    const sessionTime = du ? du.session_time : 0;
    // 视频进度
    const vp = db.prepare('SELECT last_position FROM video_progress WHERE video_id = ?').get(videoId);
    const lastPosition = vp ? vp.last_position : 0;

    console.log('【主进程】返回观看时长:', { totalTime, sessionTime, lastPosition });
    return { totalTime, sessionTime, lastPosition };
  });

  // [post-ts-migration cleanup] 已删除：saveLearningRecord / getLearningRecords /
  // checkDatabaseStatus / deleteLearningRecord / getLearningStats —— 它们读写
  // learning_records 或 ai_queries（均已废弃），且前端无任何调用方。

  // 文件选择器对话框
  ipcMain.handle('dialog:openFile', async (event, options) => {
    const result = await dialog.showOpenDialog(getMainWindow(), options);
    return result;
  });

  // [post-ts-migration cleanup] 已删除 getWatchingStats（无前端调用方，watch_time 表也未在使用）

  // 新增: 处理提取视频帧请求
  ipcMain.handle('extract-frame', async (event, { videoPath, timestamp }) => {
    console.log(`【主进程】收到 extract-frame 请求: ${videoPath} @ ${timestamp}s`);
    try {
      const framePath = await extractFrame(videoPath, timestamp);
      const imageBuffer = await fs.promises.readFile(framePath);
      const base64Image = imageBuffer.toString('base64');
      const mimeType = 'image/jpeg';
      const dataUrl = `data:${mimeType};base64,${base64Image}`;
      cleanupTempFile(framePath);
      return { success: true, dataUrl: dataUrl };
    } catch (error) {
      console.error('【主进程】处理 extract-frame 请求失败:', error);
      return { success: false, error: error.message };
    }
  });

  // [S7] 已删除：saveAiQuery / getCachedAiQuery / saveQueryHistory / getAiQueriesToday
  // 这些 handler 对应的 ai_queries / query_history 表已废弃，统一走 highlights。

  // 添加IPC处理器让渲染进程可以触发安装更新
  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall();
  });

  // IPC：在主进程中发起 AI 请求，避免渲染进程 CORS 限制
  ipcMain.handle('performAIRequest', async (event, { requestData, apiUrl, apiKey }) => {
    try {
      const response = await axios.post(
        apiUrl,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          }
        }
      );
      return { success: true, data: response.data };
    } catch (error) {
      console.error('【主进程】AI 请求失败:', error.message || error.code || 'unknown');
      return { success: false, error: error.message };
    }
  });

  // IPC：流式 AI 请求（SSE）
  ipcMain.handle('performAIStream', async (event, { requestData, apiUrl, apiKey }) => {
    // 生成请求ID用于在渲染进程区分不同流
    const requestId = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      // 强制启用流式
      const payload = { ...requestData, stream: true };
      const response = await axios.post(apiUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          Authorization: `Bearer ${apiKey}`
        },
        responseType: 'stream',
        timeout: 0
      });

      const stream = response.data; // Node Readable
      let buffer = '';

      const sendDelta = (content) => {
        if (content && typeof content === 'string' && content.length > 0) {
          try {
            if (event?.sender && !event.sender.isDestroyed()) {
              event.sender.send('ai-stream', { requestId, type: 'delta', content });
            }
          } catch (e) {
            console.error('【主进程】发送 delta 失败:', e);
          }
        }
      };

      const sendComplete = (extra = {}) => {
        try {
          if (event?.sender && !event.sender.isDestroyed()) {
            event.sender.send('ai-stream', { requestId, type: 'complete', ...extra });
          }
        } catch (e) {
          console.error('【主进程】发送 complete 失败:', e);
        }
      };

      const sendError = (message) => {
        try {
          if (event?.sender && !event.sender.isDestroyed()) {
            event.sender.send('ai-stream', { requestId, type: 'error', message });
          }
        } catch (e) {
          console.error('【主进程】发送 error 失败:', e);
        }
      };

      const processEventChunk = (chunkStr) => {
        const lines = chunkStr.split('\n');
        const dataLines = [];
        for (const line of lines) {
          if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trim());
          }
        }
        if (dataLines.length === 0) return;
        const dataStr = dataLines.join('\n');
        if (dataStr === '[DONE]') {
          sendComplete();
          try { stream.destroy(); } catch (_) {}
          return;
        }
        try {
          const json = JSON.parse(dataStr);
          // 兼容多种返回结构
          const choice = json?.choices?.[0] || {};
          const deltaContent = choice?.delta?.content;
          const messageContent = choice?.message?.content;
          const textField = json?.text || json?.data?.text || json?.result?.text;
          const piece = deltaContent || messageContent || textField || '';
          if (typeof piece === 'string') {
            sendDelta(piece);
          }
        } catch (e) {
          // 不是 JSON 则忽略
        }
      };

      stream.on('data', (chunk) => {
        try {
          buffer += chunk.toString('utf8');
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';
          for (const part of parts) {
            if (part.trim().length > 0) processEventChunk(part);
          }
        } catch (e) {
          console.error('【主进程】处理流数据失败:', e);
        }
      });

      stream.on('end', () => {
        sendComplete();
      });

      stream.on('error', (err) => {
        console.error('【主进程】SSE 流错误:', err?.message || err?.code || 'unknown');
        sendError(err?.message || 'SSE 流错误');
      });

      // 立即返回请求ID，让渲染进程开始监听
      return { success: true, requestId };
    } catch (error) {
      console.error('【主进程】AI 流式请求失败:', error.message || error.code || 'unknown');
      return { success: false, error: error?.message || 'AI 流式请求失败' };
    }
  });

  ipcMain.handle('readVideoFile', (event, filePath) => {
    try {
      // 读取视频文件并返回数据
      return fs.readFileSync(filePath);
    } catch (error) {
      console.error('【主进程】读取视频文件失败:', error);
      throw error;
    }
  });

  // 新增：分段读取视频数据接口，返回指定偏移和长度的 Buffer
  ipcMain.handle('readVideoChunk', async (event, videoPath, offset, length) => {
    try {
      const fd = await fs.promises.open(videoPath, 'r');
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await fd.read(buffer, 0, length, offset);
      await fd.close();
      // 如果读取的字节少于请求长度，截断返回
      return bytesRead < length ? buffer.slice(0, bytesRead) : buffer;
    } catch (error) {
      console.error('【主进程】readVideoChunk 错误:', error);
      return null;
    }
  });

  // 视频格式转换处理程序 - 增强版
  ipcMain.handle('convertVideo', async (event, options) => {
    const {
      inputPath,
      outputPath,
      videoCodec = 'libx264',
      audioCodec = 'aac',
      format = 'mp4',
      quality = 'medium',
      preset = 'medium'
    } = options;

    console.log('开始转换视频:', { inputPath, outputPath, videoCodec, audioCodec, quality, preset });

    try {
      // 检查输入文件
      if (!fs.existsSync(inputPath)) {
        throw new Error('输入文件不存在');
      }

      // 检查输出目录
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      return new Promise((resolve, reject) => {
        const ffmpegCommand = ffmpeg(inputPath)
          .output(outputPath)
          .videoCodec(videoCodec)
          .audioCodec(audioCodec)
          .format(format);

        // 根据质量设置参数
        switch (quality) {
          case 'high':
            ffmpegCommand
              .videoBitrate('2000k')
              .audioBitrate('192k')
              .size('1920x1080');
            break;
          case 'medium':
            ffmpegCommand
              .videoBitrate('1200k')
              .audioBitrate('128k')
              .size('1280x720');
            break;
          case 'fast':
            ffmpegCommand
              .videoBitrate('800k')
              .audioBitrate('96k')
              .size('854x480');
            break;
          default:
            // 默认使用中等质量
            ffmpegCommand
              .videoBitrate('1200k')
              .audioBitrate('128k')
              .size('1280x720');
        }

        // 设置编码预设（速度vs质量平衡）
        if (preset) {
          ffmpegCommand.outputOptions(`-preset ${preset}`);
        }

        // 其他优化选项
        ffmpegCommand
          .outputOptions('-movflags faststart') // MP4快速启动
          .outputOptions('-avoid_negative_ts make_zero') // 避免负时间戳
          .on('start', (commandLine) => {
            console.log('转换命令:', commandLine);
          })
          .on('progress', (progress) => {
            console.log('转换进度:', progress);
            // 发送进度到渲染进程
            if (event.sender && !event.sender.isDestroyed()) {
              event.sender.send('conversion-progress', {
                ...progress,
                inputPath,
                outputPath
              });
            }
          })
          .on('end', () => {
            console.log('视频转换完成:', outputPath);
            // 验证输出文件
            if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
              const stats = fs.statSync(outputPath);
              resolve({
                success: true,
                outputPath,
                message: '视频转换成功',
                fileSize: stats.size,
                conversionOptions: { videoCodec, audioCodec, quality, preset }
              });
            } else {
              reject({
                success: false,
                error: '转换后的文件无效'
              });
            }
          })
          .on('error', (err) => {
            console.error('视频转换错误:', err);
            reject({
              success: false,
              error: err.message || '视频转换失败'
            });
          })
          .run();
      });
    } catch (error) {
      console.error('视频转换过程出错:', error);
      return {
        success: false,
        error: error.message || '视频转换失败'
      };
    }
  });

  // 检查视频格式
  ipcMain.handle('checkVideoFormat', async (event, filePath) => {
    console.log('检查视频格式:', filePath);

    try {
      // 首先检查文件是否存在
      if (!fs.existsSync(filePath)) {
        throw new Error('文件不存在');
      }

      // 检查文件大小
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        throw new Error('文件大小为0');
      }

      // 使用 Promise 包装 ffprobe
      const metadata = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, data) => {
          if (err) {
            console.error('FFprobe错误:', err);
            reject(new Error(`ffprobe错误: ${err.message}`));
            return;
          }
          resolve(data);
        });
      });

      // 检查元数据格式
      if (!metadata || !metadata.format) {
        throw new Error('无法获取视频格式信息');
      }

      const result = {
        success: true,
        format: metadata.format.format_name,
        isMP4: metadata.format.format_name.includes('mp4'),
        duration: metadata.format.duration,
        size: metadata.format.size,
        bitrate: metadata.format.bit_rate
      };

      console.log('视频格式检查结果:', result);
      return result;

    } catch (error) {
      console.error('检查视频格式时发生错误:', error);
      return {
        success: false,
        error: error.message || '未知错误',
        code: error.code || 'UNKNOWN_ERROR'
      };
    }
  });

  // prepareVideo: 转换 mkv/avi 到 mp4
  ipcMain.handle('prepareVideo', async (event, inputPath) => {
    const ext = path.extname(inputPath).toLowerCase();
    if (ext !== '.mp4') {
      // 确保缓存目录存在
      if (!fs.existsSync(CACHE_CONFIG.tmpDir)) {
        await fs.promises.mkdir(CACHE_CONFIG.tmpDir, { recursive: true });
      }

      const outputPath = path.join(CACHE_CONFIG.tmpDir, path.basename(inputPath, ext) + '.mp4');

      // 如果缓存文件不存在，进行转换
      if (!fs.existsSync(outputPath)) {
        await new Promise((resolve, reject) => {
          ffmpeg(inputPath)
            .outputOptions([
              '-preset veryfast',
              '-crf 28',
              '-movflags faststart',
              '-threads 0'
            ])
            .output(outputPath)
            .videoCodec('libx264')
            .audioCodec('aac')
            .format('mp4')
            .on('end', resolve)
            .on('error', reject)
            .run();
        });
      }

      // 检查缓存大小，如果超过限制则清理
      await cleanupCache();

      return outputPath;
    }
    return inputPath;
  });

  // 添加清理缓存的 IPC 处理程序
  ipcMain.handle('cleanupVideoCache', async () => {
    try {
      await cleanupCache();
      return { success: true };
    } catch (error) {
      console.error('清理视频缓存失败:', error);
      return { success: false, error: error.message };
    }
  });

  // 检查文件是否存在
  ipcMain.handle('checkFileExists', async (event, filePath) => {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  });

  // 确保目录存在
  ipcMain.handle('ensureDirectoryExists', async (event, dirPath) => {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log('创建目录:', dirPath);
      }
      return true;
    } catch (error) {
      console.error('创建目录失败:', error);
      return false;
    }
  });

  // 添加字典查询的IPC处理
  ipcMain.handle('lookupWord', async (event, word) => {
    try {
      if (!checkDictionaryFile()) {
        throw new Error('字典文件不存在');
      }

      const dict = getDictionaryInstance();
      const def = dict.lookup(word);

      if (!def || !def.definition) {
        return { success: false, error: '未找到该单词' };
      }

      return {
        success: true,
        data: def.definition
      };
    } catch (error) {
      console.error('字典查询失败:', error);
      return { success: false, error: error.message };
    }
  });

  // 导出今日学习记录为 PDF
  ipcMain.handle('export-learning-today-pdf', async (event, { html, title, suggestedName }) => {
    let tempWin = null;
    try {
      if (!html || typeof html !== 'string' || html.trim().length === 0) {
        return { success: false, error: '空的HTML内容' };
      }

      // 包装完整HTML文档，附带基础样式
      const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"/>`
        + `<title>${title || '学习记录'}</title>`
        + `<style>
        /* 更紧凑的打印版式：小字号、窄边距、允许分割记录 */
        :root { --base-font: 9pt; --h1: 11pt; --h2: 10pt; --code: 8pt; }
        html, body { height: 100%; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
          color: #111;
          font-size: var(--base-font);
          line-height: 1.3;
          padding: 0;
          margin: 0;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          word-wrap: break-word;
          overflow-wrap: anywhere;
          hyphens: auto;
          letter-spacing: 0.1px;
        }
        .container { padding: 4mm 4mm; }
        h1 { font-size: var(--h1); margin: 0 0 4pt; color: #0b5fff; }
        h2 { font-size: var(--h2); margin: 6pt 0 3pt; color: #0b5fff; }
        strong { color: #0b5fff; font-weight: 600; }
        code { background: #fff6e6; color: #b85c00; padding: 1px 2px; border-radius: 2px; font-size: var(--code); }
        .phonetic { color: #0a7b83; font-weight: 600; }
        .record {
          break-inside: auto; /* 允许在记录内部分页以提升紧凑度 */
          page-break-inside: auto;
          margin: 0 0 4pt;
          padding-bottom: 3pt;
          border-bottom: 0.25pt solid #eee;
        }
        .record:last-child { border-bottom: none; }
        @page { size: A4; margin: 8mm 8mm; }
      </style>`
        + `</head><body><div class="container">${html}</div></body></html>`;

      tempWin = new BrowserWindow({
        show: false,
        width: 794, // 约A4宽（96DPI参考）
        height: 1123,
        webPreferences: {
          sandbox: true
        }
      });

      await tempWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(fullHtml));

      const pdfBuffer = await tempWin.webContents.printToPDF({
        marginsType: 1, // 默认边距
        printBackground: true,
        pageSize: 'A4',
        landscape: false,
        preferCSSPageSize: true
      });

      const defaultName = (suggestedName && suggestedName.endsWith('.pdf'))
        ? suggestedName
        : `learning-${new Date().toISOString().slice(0, 10)}.pdf`;
      const defaultPath = path.join(app.getPath('documents'), defaultName);

      const { filePath, canceled } = await dialog.showSaveDialog({
        title: '保存学习记录PDF',
        defaultPath,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      });
      if (canceled || !filePath) {
        return { success: false, canceled: true };
      }

      await fs.promises.writeFile(filePath, pdfBuffer);
      return { success: true, filePath };
    } catch (error) {
      console.error('【主进程】导出PDF失败:', error);
      return { success: false, error: error.message || '导出PDF失败' };
    } finally {
      try { if (tempWin && !tempWin.isDestroyed()) tempWin.destroy(); } catch (_) {}
    }
  });

  // ==================== 学习Agent相关IPC处理 ====================

  // [S7] 已删除：getLearningOverview / analyzeLearningPattern / getLearningReport / getWordFrequencyStats
  // 这些 handler 全部基于已废弃的 ai_queries 表，前端改为直接聚合 highlights。

  // 保存学习计划
  ipcMain.handle('saveStudyPlan', (event, payload) => {
    const db = getDb();
    if (!db) return { error: '数据库未初始化' };

    try {
      const planData = payload?.planData || payload?.planText || JSON.stringify(payload?.plan || payload?.structuredPlan || {}, null, 2);
      const structuredPlan = payload?.structuredPlan || payload?.plan || {};
      const days = payload?.days || structuredPlan?.days || 7;
      const createdAt = payload?.createdAt || new Date().toISOString();

      if (!planData) {
        return { error: '学习计划内容不能为空' };
      }

      // 将旧计划标记为completed
      db.prepare('UPDATE study_plans SET status = ? WHERE status = ?').run('completed', 'active');

      const stmt = db.prepare(`
      INSERT INTO study_plans (plan_data, structured_plan, days, status, created_at, updated_at)
      VALUES (?, ?, ?, 'active', ?, ?)
    `);

      stmt.run(
        planData,
        JSON.stringify(structuredPlan),
        days,
        createdAt,
        new Date().toISOString()
      );

      return { success: true };
    } catch (error) {
      console.error('保存学习计划失败:', error);
      return { error: error.message };
    }
  });

  // 获取当前学习计划
  ipcMain.handle('getCurrentStudyPlan', (event) => {
    const db = getDb();
    if (!db) return { error: '数据库未初始化' };

    try {
      const plan = db.prepare(`
      SELECT * FROM study_plans 
      WHERE status = 'active' 
      ORDER BY created_at DESC 
      LIMIT 1
    `).get();

      if (!plan) return null;

      return {
        ...plan,
        structuredPlan: plan.structured_plan ? JSON.parse(plan.structured_plan) : null
      };
    } catch (error) {
      console.error('获取学习计划失败:', error);
      return { error: error.message };
    }
  });

  // 更新学习计划进度
  ipcMain.handle('updatePlanProgress', (event, progress) => {
    const db = getDb();
    if (!db) return { error: '数据库未初始化' };

    try {
      db.prepare(`
      UPDATE study_plans 
      SET progress = ?, updated_at = ? 
      WHERE status = 'active'
    `).run(progress.progress || 0, new Date().toISOString());

      return { success: true };
    } catch (error) {
      console.error('更新学习计划进度失败:', error);
      return { error: error.message };
    }
  });

  // [S7] 已删除：getWordsToReview / getVocabularyCard / updateVocabularyCard / addVocabularyWord / extractWordsFromQueries / getVocabularyStats
  // 这些 handler 全部基于已废弃的 vocabulary / vocabulary_reviews 表，前端改用 highlights 相关 API（getDueHighlights / submitReview / getHighlightsStats / createHighlight）。

  // ===== T1-2: highlights CRUD handlers =====

  // createHighlight (UPSERT by video_path + original_text)
  ipcMain.handle('createHighlight', (event, highlightData) => {
    const db = getDb();
    if (!db) return { error: '数据库未初始化' };
    try {
      const now = new Date().toISOString();
      const {
        video_path, video_title, start_time, end_time, original_text,
        context_before, context_after, explanation, user_note,
        language, status, ease, interval, repetitions, next_review, last_review
      } = highlightData || {};

      const text = (original_text || '').trim();
      if (!text) return { error: 'original_text required' };

      // OCR 场景 video_path 可能没传，统一存 '' 而不是 null（让 UNIQUE 索引可去重）
      const vp = video_path || '';
      const id = require('crypto').randomUUID();

      db.prepare(`
        INSERT INTO highlights (
          id, video_path, video_title, start_time, end_time, original_text,
          context_before, context_after, explanation, user_note, language,
          status, ease, interval, repetitions, next_review, last_review,
          query_count, last_queried_at, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
        ON CONFLICT(video_path, original_text) DO UPDATE SET
          query_count = query_count + 1,
          last_queried_at = excluded.last_queried_at,
          explanation = COALESCE(excluded.explanation, explanation),
          language = COALESCE(excluded.language, language),
          context_before = COALESCE(excluded.context_before, context_before),
          context_after = COALESCE(excluded.context_after, context_after),
          start_time = COALESCE(excluded.start_time, start_time),
          end_time = COALESCE(excluded.end_time, end_time),
          updated_at = excluded.updated_at
      `).run(
        id, vp, video_title || null, start_time ?? null, end_time ?? null,
        text, context_before || null, context_after || null,
        explanation || null, user_note || null, language || null,
        status || 'learning', ease ?? 2.5, interval ?? 0, repetitions ?? 0,
        next_review || null, last_review || null, now, now, now
      );

      const highlight = db.prepare(
        'SELECT * FROM highlights WHERE video_path = ? AND original_text = ?'
      ).get(vp, text);
      return { success: true, id: highlight.id, highlight };
    } catch (error) {
      console.error('createHighlight error:', error);
      return { error: error.message };
    }
  });

  // getHighlights (by video or status)
  ipcMain.handle('getHighlights', (event, { videoPath, status, limit = 100, offset = 0 } = {}) => {
    const db = getDb();
    if (!db) return { error: '数据库未初始化' };
    try {
      let sql = 'SELECT * FROM highlights WHERE 1=1';
      const params = [];

      if (videoPath) {
        sql += ' AND video_path = ?';
        params.push(videoPath);
      }
      if (status) {
        sql += ' AND status = ?';
        params.push(status);
      }

      sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const highlights = db.prepare(sql).all(...params);
      return { highlights, total: highlights.length };
    } catch (error) {
      console.error('getHighlights error:', error);
      return { error: error.message };
    }
  });

  // getHighlight
  ipcMain.handle('getHighlight', (event, { id }) => {
    const db = getDb();
    if (!db) return { error: '数据库未初始化' };
    try {
      if (!id) return { error: 'id is required' };
      const highlight = db.prepare('SELECT * FROM highlights WHERE id = ?').get(id);
      if (!highlight) return { error: 'Not found' };
      return highlight;
    } catch (error) {
      console.error('getHighlight error:', error);
      return { error: error.message };
    }
  });

  // updateHighlight
  ipcMain.handle('updateHighlight', (event, { id, ...fields }) => {
    const db = getDb();
    if (!db) return { error: '数据库未初始化' };
    try {
      if (!id) return { error: 'id is required' };

      const allowedFields = ['explanation', 'user_note', 'status', 'ease', 'interval', 'repetitions', 'next_review', 'last_review'];
      const updates = [];
      const params = [];

      for (const field of allowedFields) {
        if (fields[field] !== undefined) {
          updates.push(`${field} = ?`);
          params.push(fields[field]);
        }
      }

      if (updates.length === 0) return { error: 'No fields to update' };

      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(id);

      db.prepare(`UPDATE highlights SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      return { success: true };
    } catch (error) {
      console.error('updateHighlight error:', error);
      return { error: error.message };
    }
  });

  // deleteHighlight
  ipcMain.handle('deleteHighlight', (event, { id }) => {
    const db = getDb();
    if (!db) return { error: '数据库未初始化' };
    try {
      if (!id) return { error: 'id is required' };
      db.prepare('DELETE FROM highlights WHERE id = ?').run(id);
      return { success: true };
    } catch (error) {
      console.error('deleteHighlight error:', error);
      return { error: error.message };
    }
  });

  // ===== T1-3: SRS handlers =====

  // SM-2 algorithm simplified implementation
  function calculateSM2(highlight, quality) {
    let { ease, interval, repetitions } = highlight;
    // quality: 0=blackout, 1=hard, 2=good, 3=easy
    if (quality < 2) {
      // 重来或困难：重新开始
      repetitions = 0;
      interval = 1;
    } else {
      // 良好或简单
      if (repetitions === 0) interval = 1;
      else if (repetitions === 1) interval = 6;
      else interval = Math.round(interval * ease);
      repetitions += 1;
    }
    // 更新 ease
    ease = ease + (0.1 - (3 - quality) * (0.08 + (3 - quality) * 0.02));
    if (ease < 1.3) ease = 1.3;
    // 下次复习时间
    const next_review = new Date();
    next_review.setDate(next_review.getDate() + interval);
    return { ease, interval, repetitions, next_review: next_review.toISOString() };
  }

  // getDueHighlights
  ipcMain.handle('getDueHighlights', (event, { limit = 20, status } = {}) => {
    const db = getDb();
    if (!db) return { error: '数据库未初始化' };
    try {
      const now = new Date().toISOString();
      let sql = 'SELECT * FROM highlights WHERE (next_review IS NULL OR next_review <= ?)';
      const params = [now];

      if (status) {
        sql += ' AND status = ?';
        params.push(status);
      }

      sql += ' ORDER BY next_review ASC NULLS FIRST, created_at ASC LIMIT ?';
      params.push(limit);

      const highlights = db.prepare(sql).all(...params);
      return highlights;
    } catch (error) {
      console.error('getDueHighlights error:', error);
      return { error: error.message };
    }
  });

  // submitReview
  ipcMain.handle('submitReview', (event, { id, quality }) => {
    const db = getDb();
    if (!db) return { error: '数据库未初始化' };
    try {
      if (!id) return { error: 'id is required' };
      if (quality === undefined || quality === null) return { error: 'quality is required' };

      // Get current highlight
      const highlight = db.prepare('SELECT * FROM highlights WHERE id = ?').get(id);
      if (!highlight) return { error: 'Highlight not found' };

      // Calculate new SRS values using SM-2
      const { ease, interval, repetitions, next_review } = calculateSM2(highlight, quality);

      // Update highlight
      db.prepare(`
        UPDATE highlights
        SET ease = ?, interval = ?, repetitions = ?, next_review = ?,
            last_review = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).run(ease, interval, repetitions, next_review, id);

      return { success: true, srs_data: { ease, interval, repetitions, next_review } };
    } catch (error) {
      console.error('submitReview error:', error);
      return { error: error.message };
    }
  });

  // ===== T1-3 bonus: highlights stats aggregation =====
  ipcMain.handle('getHighlightsStats', () => {
    const db = getDb();
    if (!db) return { error: '数据库未初始化' };
    try {
      const total = db.prepare('SELECT COUNT(*) as count FROM highlights').get().count;
      const byStatus = db.prepare(`
        SELECT status, COUNT(*) as count FROM highlights GROUP BY status
      `).all();
      const totalVideos = db.prepare(
        'SELECT COUNT(DISTINCT video_path) as count FROM highlights'
      ).get().count;
      const todayReviewed = db.prepare(`
        SELECT COUNT(*) as count FROM highlights
        WHERE date(last_review) = date('now', 'localtime')
      `).get().count;
      // streakDays: count consecutive days ending today with at least 1 review
      const reviewDays = db.prepare(`
        SELECT DISTINCT date(last_review) as day FROM highlights
        WHERE last_review IS NOT NULL ORDER BY day DESC
      `).all().map(r => r.day);
      let streak = 0;
      const today = new Date().toISOString().slice(0, 10);
      for (let i = 0; i < reviewDays.length; i++) {
        const expected = new Date();
        expected.setDate(expected.getDate() - i);
        if (reviewDays[i] === expected.toISOString().slice(0, 10)) streak++;
        else break;
      }
      const statusMap = {};
      byStatus.forEach(r => { statusMap[r.status] = r.count; });
      return {
        totalHighlights: total,
        pendingHighlights: statusMap.pending || 0,
        reviewedHighlights: statusMap.reviewed || 0,
        archivedHighlights: statusMap.archived || 0,
        masteredHighlights: statusMap.mastered || 0,
        totalVideos,
        todayReviewed,
        streakDays: streak
      };
    } catch (error) {
      console.error('getHighlightsStats error:', error);
      return { error: error.message };
    }
  });

  // S5: highlights 每日新增计数（趋势图用）
  ipcMain.handle('getHighlightsDailyCount', (event, { days = 7 } = {}) => {
    const db = getDb();
    if (!db) return { error: '数据库未初始化' };
    try {
      const rows = db.prepare(`
        SELECT date(created_at, 'localtime') as date, COUNT(*) as count
        FROM highlights
        WHERE date(created_at, 'localtime') >= date('now', 'localtime', ?)
        GROUP BY date(created_at, 'localtime')
        ORDER BY date ASC
      `).all(`-${days - 1} days`);

      // 填充缺失日期为 0，保证数组长度 = days
      const map = {};
      rows.forEach(r => { map[r.date] = r.count; });
      const result = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        result.push({ date: key, count: map[key] || 0 });
      }
      return result;
    } catch (error) {
      console.error('getHighlightsDailyCount error:', error);
      return { error: error.message };
    }
  });

  // S6: 获取今日新增的 highlights（按 created_at 当天 localtime）
  ipcMain.handle('getTodayHighlights', () => {
    const db = getDb();
    if (!db) return { error: '数据库未初始化' };
    try {
      const rows = db.prepare(`
        SELECT * FROM highlights
        WHERE date(created_at, 'localtime') = date('now', 'localtime')
        ORDER BY created_at DESC
      `).all();
      return rows;
    } catch (error) {
      console.error('getTodayHighlights error:', error);
      return { error: error.message };
    }
  });
}

module.exports = {
  registerIpcHandlers
};
