const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseSync } = require('subtitle');
const { extractFrame, cleanupTempFile } = require('../videoFrameExtractor');
const { ffmpeg } = require('../media/ffmpeg');
const { getVideoServerPort, getVideoServerError } = require('../services/videoServer');

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
  ipcMain.handle('getVideoServerPort', () => {
    const port = getVideoServerPort();
    const error = getVideoServerError();
    if (error || !port) {
      const message = error
        ? `视频服务端口不可用: ${error.message}`
        : '视频服务端口尚未就绪';
      throw new Error(message);
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

  // 保存学习记录
  ipcMain.handle('saveLearningRecord', (event, { videoId, subtitleId, content, translation, note }) => {
    console.log('【主进程】收到saveLearningRecord请求:', { videoId, subtitleId, content });

    const db = getDb();
    if (!db) {
      console.error('【主进程】数据库未初始化，无法保存学习记录');
      return { success: false, error: '数据库未初始化' };
    }

    const created_at = new Date().toISOString();

    try {
      const stmt = db.prepare(
        'INSERT INTO learning_records (video_id, subtitle_id, content, translation, note, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      );
      const result = stmt.run(videoId, subtitleId, content, translation, note, created_at);
      console.log('【主进程】保存学习记录成功:', result);
      return { success: true, id: result.lastInsertRowid }; // 返回成功和 ID
    } catch (error) {
      console.error('【主进程】保存学习记录失败:', error);
      return { success: false, error: error.message }; // 返回失败
    }
  });

  // 获取学习记录
  ipcMain.handle('getLearningRecords', (event, { videoId }) => {
    console.log('【主进程】收到getLearningRecords请求:', { videoId });

    const db = getDb();
    if (!db) {
      console.error('【主进程】数据库未初始化，返回空学习记录');
      return []; // 直接返回空数组
    }

    try {
      const stmt = db.prepare('SELECT * FROM learning_records WHERE video_id = ? ORDER BY created_at DESC');
      const rows = stmt.all(videoId);
      console.log('【主进程】获取学习记录成功，共', rows.length, '条记录');
      return rows; // 直接返回记录数组
    } catch (error) {
      console.error('【主进程】获取学习记录失败:', error);
      return []; // 出错时也返回空数组
    }
  });

  // 文件选择器对话框
  ipcMain.handle('dialog:openFile', async (event, options) => {
    const result = await dialog.showOpenDialog(getMainWindow(), options);
    return result;
  });

  // 添加新的IPC处理函数，用于检查数据库状态
  ipcMain.handle('checkDatabaseStatus', (event) => {
    console.log('【主进程】收到检查数据库状态请求');

    const db = getDb();
    try {
      if (!db) {
        console.log('【主进程】数据库未初始化');
        return { isConnected: false, error: '数据库未初始化' };
      }

      // 尝试执行简单查询以确认数据库状态正常
      const result = db.prepare('SELECT COUNT(*) as count FROM ai_queries').get();
      console.log('【主进程】数据库状态检查结果:', result);

      return {
        isConnected: true,
        recordCount: result.count
      };
    } catch (error) {
      console.error('【主进程】检查数据库状态失败:', error);
      return {
        isConnected: false,
        error: error.message
      };
    }
  });

  // 删除学习记录
  ipcMain.on('deleteLearningRecord', (event, { recordId }) => {
    console.log('【主进程】收到deleteLearningRecord请求:', { recordId });

    const db = getDb();
    const mainWindow = getMainWindow();
    if (!db) {
      console.error('【主进程】数据库未初始化，无法删除学习记录');
      mainWindow.webContents.send('error', { message: '数据库未初始化，无法删除学习记录' });
      return;
    }

    try {
      const stmt = db.prepare('DELETE FROM learning_records WHERE id = ?');
      const result = stmt.run(recordId);

      console.log('【主进程】删除学习记录结果:', result);

      if (result.changes > 0) {
        console.log('【主进程】成功删除学习记录');
        mainWindow.webContents.send('learningRecordDeleted', {
          success: true,
          recordId
        });
      } else {
        console.log('【主进程】未找到要删除的记录');
        mainWindow.webContents.send('learningRecordDeleted', {
          success: false,
          message: '未找到要删除的记录'
        });
      }
    } catch (error) {
      console.error('【主进程】删除学习记录失败:', error);
      mainWindow.webContents.send('error', { message: '删除学习记录失败', error: error.message });
    }
  });

  // 获取学习统计数据
  ipcMain.on('getLearningStats', (event) => {
    console.log('【主进程】收到getLearningStats请求');

    const db = getDb();
    const mainWindow = getMainWindow();
    if (!db) {
      console.error('【主进程】数据库未初始化，无法获取学习统计');
      mainWindow.webContents.send('learningStats', {
        totalRecords: 0,
        totalVideos: 0,
        recentRecords: []
      });
      return;
    }

    try {
      // 获取总记录数
      const totalRecordsStmt = db.prepare('SELECT COUNT(*) as count FROM learning_records');
      const totalRecords = totalRecordsStmt.get().count;

      // 获取学习过的视频数量
      const totalVideosStmt = db.prepare('SELECT COUNT(DISTINCT video_id) as count FROM learning_records');
      const totalVideos = totalVideosStmt.get().count;

      // 获取最近10条学习记录
      const recentRecordsStmt = db.prepare(
        'SELECT * FROM learning_records ORDER BY created_at DESC LIMIT 10'
      );
      const recentRecords = recentRecordsStmt.all();

      console.log('【主进程】学习统计数据:', {
        totalRecords,
        totalVideos,
        recentRecordsCount: recentRecords.length
      });

      mainWindow.webContents.send('learningStats', {
        totalRecords,
        totalVideos,
        recentRecords
      });
    } catch (error) {
      console.error('【主进程】获取学习统计失败:', error);
      mainWindow.webContents.send('error', { message: '获取学习统计失败', error: error.message });

      // 发送默认数据
      mainWindow.webContents.send('learningStats', {
        totalRecords: 0,
        totalVideos: 0,
        recentRecords: []
      });
    }
  });

  // 获取视频观看统计数据
  ipcMain.on('getWatchingStats', (event) => {
    // console.log('【主进程】收到getWatchingStats请求');

    const db = getDb();
    const mainWindow = getMainWindow();
    if (!db) {
      console.error('【主进程】数据库未初始化，无法获取观看统计数据');
      mainWindow.webContents.send('watchingStats', {
        totalWatchTime: 0,
        videoCount: 0,
        recentWatched: []
      });
      return;
    }

    try {
      // 获取总观看时长（秒）
      const totalTimeStmt = db.prepare('SELECT SUM(total_time) as total FROM watch_time');
      const totalResult = totalTimeStmt.get();
      const totalWatchTime = totalResult.total || 0;

      // 获取已观看视频数量
      const countStmt = db.prepare('SELECT COUNT(*) as count FROM watch_time');
      const countResult = countStmt.get();
      const videoCount = countResult.count || 0;

      // 获取最近观看的5个视频
      const recentStmt = db.prepare(
        'SELECT * FROM watch_time ORDER BY last_watched DESC LIMIT 5'
      );
      const recentWatched = recentStmt.all();

      console.log('【主进程】观看统计数据:', {
        totalWatchTime,
        videoCount,
        recentCount: recentWatched.length
      });

      mainWindow.webContents.send('watchingStats', {
        totalWatchTime,
        videoCount,
        recentWatched
      });
    } catch (error) {
      console.error('【主进程】获取观看统计数据失败:', error);
      mainWindow.webContents.send('error', { message: '获取观看统计数据失败', error: error.message });

      // 发送默认数据
      mainWindow.webContents.send('watchingStats', {
        totalWatchTime: 0,
        videoCount: 0,
        recentWatched: []
      });
    }
  });

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

  // IPC 处理：保存 AI 查询记录
  ipcMain.handle('saveAiQuery', (event, { query, explanation, timestamp }) => {
    console.log('【主进程】收到 saveAiQuery 请求:', { query });
    const db = getDb();
    if (!db) return { success: false, error: '数据库未初始化' };
    try {
      const stmt = db.prepare('INSERT INTO ai_queries (query, explanation, created_at) VALUES (?, ?, ?)');
      const result = stmt.run(query, explanation, timestamp);
      return { success: true, id: result.lastInsertRowid };
    } catch (error) {
      console.error('【主进程】保存 AI 查询失败:', error);
      return { success: false, error: error.message };
    }
  });

  // IPC 处理：查询本地缓存的 AI 结果（命中则更新时间并返回）
  ipcMain.handle('getCachedAiQuery', (event, { query }) => {
    try {
      const db = getDb();
      if (!db) return { hit: false };
      if (!query || typeof query !== 'string') return { hit: false };
      const q = query.trim();
      if (q.length === 0) return { hit: false };
      const row = db.prepare('SELECT id, query, explanation, created_at, updated_at FROM ai_queries WHERE lower(query) = lower(?) ORDER BY updated_at DESC LIMIT 1').get(q);
      if (!row) return { hit: false };
      // 命中则更新更新时间
      db.prepare('UPDATE ai_queries SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(row.id);
      return { hit: true, explanation: row.explanation, row };
    } catch (error) {
      console.error('【主进程】获取缓存失败:', error);
      return { hit: false, error: error.message };
    }
  });

  // IPC 处理：保存查询历史记录
  ipcMain.handle('saveQueryHistory', (event, { query_text, response_text, query_type, video_id }) => {
    console.log('【主进程】收到 saveQueryHistory 请求:', { query_text });
    const db = getDb();
    if (!db) return { success: false, error: '数据库未初始化' };
    try {
      const stmt = db.prepare(
        'INSERT INTO query_history (query_text, response_text, query_type, video_id, created_at) VALUES (?, ?, ?, ?, ?)'
      );
      const result = stmt.run(
        query_text,
        response_text,
        query_type,
        video_id,
        new Date().toISOString()
      );
      return { success: true, id: result.lastInsertRowid };
    } catch (error) {
      console.error('【主进程】保存查询历史失败:', error);
      return { success: false, error: error.message };
    }
  });

  // 新增: 获取今日 AI 查询记录
  ipcMain.handle('getAiQueriesToday', (event) => {
    const db = getDb();
    if (!db) return [];
    try {
      const stmt = db.prepare("SELECT * FROM ai_queries WHERE date(created_at) = date('now','localtime') ORDER BY created_at DESC");
      const rows = stmt.all();
      return rows;
    } catch (error) {
      console.error('【主进程】获取今日 AI 查询记录失败:', error);
      return [];
    }
  });

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
      console.error('【主进程】AI 请求失败:', error);
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
        console.error('【主进程】SSE 流错误:', err);
        sendError(err?.message || 'SSE 流错误');
      });

      // 立即返回请求ID，让渲染进程开始监听
      return { success: true, requestId };
    } catch (error) {
      console.error('【主进程】AI 流式请求失败:', error);
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

  // 获取学习概况
  ipcMain.handle('getLearningOverview', (event) => {
    const db = getDb();
    if (!db) return { error: '数据库未初始化' };

    try {
      const gu = db.prepare('SELECT total_time FROM global_usage WHERE id = 1').get();
      const totalTime = gu ? gu.total_time : 0;

      const totalQueries = db.prepare('SELECT COUNT(*) as count FROM ai_queries').get().count;
      const activeDays = db.prepare('SELECT COUNT(DISTINCT date(created_at)) as count FROM ai_queries').get().count;
      const avgDailyTime = activeDays > 0 ? totalTime / activeDays : 0;

      const today = new Date().toISOString().slice(0, 10);
      const todayQueries = db.prepare('SELECT COUNT(*) as count FROM ai_queries WHERE date(created_at) = ?').get(today).count;

      return {
        totalTime,
        totalQueries,
        activeDays,
        avgDailyTime,
        todayQueries
      };
    } catch (error) {
      console.error('获取学习概况失败:', error);
      return { error: error.message };
    }
  });

  // 分析学习模式
  ipcMain.handle('analyzeLearningPattern', (event) => {
    const db = getDb();
    if (!db) return { error: '数据库未初始化' };

    try {
      // 分析最活跃时段
      const hourStats = db.prepare(`
      SELECT strftime('%H', created_at) as hour, COUNT(*) as count
      FROM ai_queries
      GROUP BY hour
      ORDER BY count DESC
      LIMIT 1
    `).get();

      const mostActiveHour = hourStats ? `${hourStats.hour}:00` : null;

      // 分析学习频率（最近7天）
      const recentCount = db.prepare(`
      SELECT COUNT(*) as count FROM ai_queries
      WHERE date(created_at) >= date('now', '-7 days')
    `).get().count;

      const frequency = recentCount > 30 ? '高频' : recentCount > 10 ? '中频' : '低频';

      // 分析最近趋势（最近3天 vs 之前3天）
      const recent3Days = db.prepare(`
      SELECT COUNT(*) as count FROM ai_queries
      WHERE date(created_at) >= date('now', '-3 days')
    `).get().count;

      const before3Days = db.prepare(`
      SELECT COUNT(*) as count FROM ai_queries
      WHERE date(created_at) >= date('now', '-6 days') AND date(created_at) < date('now', '-3 days')
    `).get().count;

      let recentTrend = '稳定';
      if (recent3Days > before3Days * 1.2) recentTrend = '上升';
      else if (recent3Days < before3Days * 0.8) recentTrend = '下降';

      return {
        mostActiveHour,
        frequency,
        recentTrend,
        recentCount
      };
    } catch (error) {
      console.error('分析学习模式失败:', error);
      return { error: error.message };
    }
  });

  // 获取学习报告
  ipcMain.handle('getLearningReport', (event, options = {}) => {
    const db = getDb();
    if (!db) return { error: '数据库未初始化' };

    const days = options.days || 7;

    try {
      const stats = db.prepare(`
      SELECT 
        COUNT(*) as totalQueries,
        COUNT(DISTINCT date(created_at)) as activeDays,
        SUM(strftime('%s', updated_at) - strftime('%s', created_at)) as totalTime
      FROM ai_queries
      WHERE date(created_at) >= date('now', '-${days} days')
    `).get();

      const dailyStats = db.prepare(`
      SELECT 
        date(created_at) as date,
        COUNT(*) as count
      FROM ai_queries
      WHERE date(created_at) >= date('now', '-${days} days')
      GROUP BY date
      ORDER BY date DESC
    `).all();

      return {
        period: `${days}天`,
        totalQueries: stats.totalQueries || 0,
        activeDays: stats.activeDays || 0,
        dailyStats
      };
    } catch (error) {
      console.error('获取学习报告失败:', error);
      return { error: error.message };
    }
  });

  // 获取单词频率统计
  ipcMain.handle('getWordFrequencyStats', (event, options = {}) => {
    const db = getDb();
    if (!db) return { error: '数据库未初始化' };

    const limit = options.limit || 50;

    try {
      // 从ai_queries中提取单词（简单提取，后续可以优化）
      const queries = db.prepare(`
      SELECT query FROM ai_queries
      WHERE LENGTH(query) < 50 AND query NOT LIKE '% %'
      ORDER BY created_at DESC
      LIMIT 500
    `).all();

      // 统计单词频率
      const wordMap = {};
      queries.forEach(q => {
        const word = q.query.trim().toLowerCase();
        if (word.length > 0 && /^[a-z]+$/.test(word)) {
          wordMap[word] = (wordMap[word] || 0) + 1;
        }
      });

      const wordStats = Object.entries(wordMap)
        .map(([word, count]) => ({ word, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

      return wordStats;
    } catch (error) {
      console.error('获取单词频率统计失败:', error);
      return { error: error.message };
    }
  });

  // 保存学习计划
  ipcMain.handle('saveStudyPlan', (event, { planData, structuredPlan, days, createdAt }) => {
    const db = getDb();
    if (!db) return { error: '数据库未初始化' };

    try {
      // 将旧计划标记为completed
      db.prepare('UPDATE study_plans SET status = ? WHERE status = ?').run('completed', 'active');

      const stmt = db.prepare(`
      INSERT INTO study_plans (plan_data, structured_plan, days, status, created_at, updated_at)
      VALUES (?, ?, ?, 'active', ?, ?)
    `);

      stmt.run(
        planData,
        JSON.stringify(structuredPlan || {}),
        days || 7,
        createdAt || new Date().toISOString(),
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

  // 获取需要复习的单词
  ipcMain.handle('getWordsToReview', (event, options = {}) => {
    const db = getDb();
    if (!db) return { error: '数据库未初始化' };

    const limit = options.limit || 20;
    const now = new Date().toISOString();

    try {
      const words = db.prepare(`
      SELECT * FROM vocabulary
      WHERE next_review IS NULL OR next_review <= ?
      ORDER BY next_review ASC NULLS FIRST, created_at ASC
      LIMIT ?
    `).all(now, limit);

      return words;
    } catch (error) {
      console.error('获取复习单词失败:', error);
      return { error: error.message };
    }
  });

  // 获取单词卡片数据
  ipcMain.handle('getVocabularyCard', (event, { wordId }) => {
    const db = getDb();
    if (!db) return { error: '数据库未初始化' };

    try {
      const card = db.prepare('SELECT * FROM vocabulary WHERE id = ?').get(wordId);
      if (!card) return { error: '单词不存在' };

      return {
        ease: card.ease,
        interval: card.interval,
        repetitions: card.repetitions,
        lastReview: card.last_review
      };
    } catch (error) {
      console.error('获取单词卡片失败:', error);
      return { error: error.message };
    }
  });

  // 更新单词卡片
  ipcMain.handle('updateVocabularyCard', (event, { wordId, ease, interval, repetitions, nextReview, lastReview, quality }) => {
    const db = getDb();
    if (!db) return { error: '数据库未初始化' };

    try {
      // 获取更新前的数据
      const before = db.prepare('SELECT ease, interval FROM vocabulary WHERE id = ?').get(wordId);

      // 更新单词卡片
      db.prepare(`
      UPDATE vocabulary
      SET ease = ?, interval = ?, repetitions = ?, next_review = ?, last_review = ?, updated_at = ?
      WHERE id = ?
    `).run(ease, interval, repetitions, nextReview, lastReview, new Date().toISOString(), wordId);

      // 记录复习历史
      if (before) {
        db.prepare(`
        INSERT INTO vocabulary_reviews (vocabulary_id, quality, ease_before, ease_after, interval_before, interval_after)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(wordId, quality, before.ease, ease, before.interval, interval);
      }

      return { success: true };
    } catch (error) {
      console.error('更新单词卡片失败:', error);
      return { error: error.message };
    }
  });

  // 添加单词到词汇表
  ipcMain.handle('addVocabularyWord', (event, wordData) => {
    const db = getDb();
    if (!db) return { error: '数据库未初始化' };

    try {
      const stmt = db.prepare(`
      INSERT OR IGNORE INTO vocabulary 
      (word, phonetic, meaning, example, explanation, ease, interval, repetitions, next_review, last_review, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

      const now = new Date().toISOString();
      stmt.run(
        wordData.word,
        wordData.phonetic || null,
        wordData.meaning || null,
        wordData.example || null,
        wordData.explanation || null,
        wordData.ease || 2.5,
        wordData.interval || 0,
        wordData.repetitions || 0,
        wordData.nextReview || now,
        wordData.lastReview || null,
        now,
        now
      );

      const word = db.prepare('SELECT * FROM vocabulary WHERE word = ?').get(wordData.word);
      return word;
    } catch (error) {
      console.error('添加单词失败:', error);
      return { error: error.message };
    }
  });

  // 从查询记录中提取单词
  ipcMain.handle('extractWordsFromQueries', (event, options = {}) => {
    const db = getDb();
    if (!db) return { error: '数据库未初始化' };

    const limit = options.limit || 50;

    try {
      // 获取查询记录
      const queries = db.prepare(`
      SELECT DISTINCT query, explanation FROM ai_queries
      WHERE LENGTH(query) < 50 AND query NOT LIKE '% %'
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit);

      let count = 0;
      const wordPattern = /^[a-z]+$/i;

      queries.forEach(q => {
        const word = q.query.trim().toLowerCase();
        if (word.length > 0 && wordPattern.test(word)) {
          try {
            // 尝试从explanation中提取音标和含义
            let phonetic = null;
            let meaning = null;

            // 简单的提取逻辑（可以从explanation中解析）
            const phoneticMatch = q.explanation.match(/`([^`]+)`/);
            if (phoneticMatch) phonetic = phoneticMatch[1];

            const meaningMatch = q.explanation.match(/\*\*.*?\*\*\s+"([^"]+)"/);
            if (meaningMatch) meaning = meaningMatch[1];

            db.prepare(`
            INSERT OR IGNORE INTO vocabulary 
            (word, phonetic, meaning, explanation, ease, interval, repetitions, next_review, created_at, updated_at)
            VALUES (?, ?, ?, ?, 2.5, 0, 0, ?, ?, ?)
          `).run(word, phonetic, meaning, q.explanation, new Date().toISOString(), new Date().toISOString(), new Date().toISOString());

            count++;
          } catch (err) {
            // 忽略重复插入错误
          }
        }
      });

      return { count };
    } catch (error) {
      console.error('提取单词失败:', error);
      return { error: error.message };
    }
  });

  // 获取词汇学习统计
  ipcMain.handle('getVocabularyStats', (event) => {
    const db = getDb();
    if (!db) return { error: '数据库未初始化' };

    try {
      const total = db.prepare('SELECT COUNT(*) as count FROM vocabulary').get().count;
      const now = new Date().toISOString();
      const dueCount = db.prepare('SELECT COUNT(*) as count FROM vocabulary WHERE next_review <= ? OR next_review IS NULL').get(now).count;
      const masteredCount = db.prepare('SELECT COUNT(*) as count FROM vocabulary WHERE repetitions >= 5').get().count;

      const recentReviews = db.prepare(`
      SELECT COUNT(*) as count FROM vocabulary_reviews
      WHERE date(created_at) = date('now', 'localtime')
    `).get().count;

      return {
        total,
        dueCount,
        masteredCount,
        recentReviews
      };
    } catch (error) {
      console.error('获取词汇统计失败:', error);
      return { error: error.message };
    }
  });
}

module.exports = {
  registerIpcHandlers
};
