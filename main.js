const { app, BrowserWindow, ipcMain, dialog, Menu, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const Store = require('electron-store'); // 引入electron-store用于保存配置
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const { registerIpcHandlers } = require('./main/ipc');
const { startVideoServer } = require('./main/services/videoServer');

// 注册为安全协议，支持流媒体加载
protocol.registerSchemesAsPrivileged([{ scheme: 'lep', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, bypassCSP: true } }]);

// 创建配置存储实例
const store = new Store();

const state = {
  mainWindow: null,
  db: null
};

registerIpcHandlers({
  app,
  ipcMain,
  dialog,
  BrowserWindow,
  store,
  state,
  autoUpdater
});

// 数据存储目录（放在用户目录，避免在 asar 内创建）
const appDataPath = app.getPath('userData');
const DATA_PATH = path.join(appDataPath, 'data');
const DB_PATH = path.join(DATA_PATH, 'userdata.db');

// 设置应用名称，用于 macOS 菜单
app.setName('LEP');

let mainWindow;
let db;

console.log('应用路径信息:', {
  __dirname,
  appDataPath,
  DATA_PATH,
  DB_PATH,
  lastVideoDir: store.get('lastVideoDir') || app.getPath('videos')
});

// 确保数据目录存在
try {
  if (!fs.existsSync(DATA_PATH)) {
    fs.mkdirSync(DATA_PATH, { recursive: true });
    console.log('创建数据目录:', DATA_PATH);
  }
} catch (error) {
  console.error('创建数据目录失败:', error);
}

// 配置日志
log.transports.file.level = 'info';
autoUpdater.logger = log;

// 配置自动更新
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// ===== 新增：本地HTTP服务器用于视频范围请求 =====
startVideoServer();

// 添加新的 app 协议
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true } }]);


// 应用启动时创建窗口
app.whenReady().then(async () => {
  // 确保数据目录存在
  if (!fs.existsSync(DATA_PATH)) {
    fs.mkdirSync(DATA_PATH, { recursive: true });
    console.log('创建数据目录');
  }
  
  // 初始化数据库连接，添加错误处理
  try {
    // 检查数据库文件是否存在
    const dbExists = fs.existsSync(DB_PATH);
    
    // 连接数据库
    db = new Database(DB_PATH);
    state.db = db;
    console.log('数据库连接成功:', DB_PATH);
    
    // 只在数据库不存在时创建表
    if (!dbExists) {
      console.log('初始化新数据库...');
      
      // 创建global_usage表，记录全局使用时间
      db.exec(`
        CREATE TABLE IF NOT EXISTS global_usage (
          id INTEGER PRIMARY KEY CHECK(id = 1),
          total_time INTEGER NOT NULL DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      // 创建 daily_usage 表，按日期记录当日会话时长
      db.exec(`
        CREATE TABLE IF NOT EXISTS daily_usage (
          date TEXT PRIMARY KEY,
          session_time INTEGER NOT NULL DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      // 创建 video_progress 表，保存每个视频的播放进度
      db.exec(`
        CREATE TABLE IF NOT EXISTS video_progress (
          video_id TEXT PRIMARY KEY,
          last_position INTEGER,
          last_watched TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      // 创建 learning_records 表，保存学习记录
      db.exec(`
        CREATE TABLE IF NOT EXISTS learning_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          video_id TEXT,
          subtitle_id INTEGER,
          content TEXT,
          translation TEXT,
          note TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);

      console.log('数据库表创建完成');
    }

    // 无论数据库是否已存在，都确保新表被创建（用于后续添加的表）
    try {
      // ===== S1: 数据层重构 =====
      // 废弃的旧表（学习数据统一到 highlights）
      // ai_queries / vocabulary / vocabulary_reviews / query_history 不再使用
      console.warn('[S1] 清理废弃表：ai_queries / vocabulary / vocabulary_reviews / query_history');
      db.exec(`
        DROP TABLE IF EXISTS ai_queries;
        DROP TABLE IF EXISTS vocabulary_reviews;
        DROP TABLE IF EXISTS vocabulary;
        DROP TABLE IF EXISTS query_history;
        DROP TABLE IF EXISTS highlights;
      `);

      // highlights：所有学习对象的单一数据源
      db.exec(`
        CREATE TABLE IF NOT EXISTS highlights (
          id TEXT PRIMARY KEY,
          video_path TEXT NOT NULL DEFAULT '',
          video_title TEXT,
          start_time REAL,
          end_time REAL,
          original_text TEXT NOT NULL,
          context_before TEXT,
          context_after TEXT,
          explanation TEXT,
          user_note TEXT,
          language TEXT,
          status TEXT DEFAULT 'learning',
          ease REAL DEFAULT 2.5,
          interval INTEGER DEFAULT 0,
          repetitions INTEGER DEFAULT 0,
          next_review TEXT,
          last_review TEXT,
          query_count INTEGER DEFAULT 1,
          last_queried_at TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          UNIQUE(video_path, original_text)
        );
      `);

      // 创建学习计划表
      db.exec(`
        CREATE TABLE IF NOT EXISTS study_plans (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          plan_data TEXT NOT NULL,
          structured_plan TEXT,
          days INTEGER DEFAULT 7,
          status TEXT DEFAULT 'active',
          progress INTEGER DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 索引
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_highlights_next_review ON highlights(next_review);
        CREATE INDEX IF NOT EXISTS idx_highlights_status ON highlights(status);
        CREATE INDEX IF NOT EXISTS idx_highlights_created_at ON highlights(created_at);
        CREATE INDEX IF NOT EXISTS idx_study_plans_status ON study_plans(status);
      `);

      console.log('[S1] highlights / study_plans 表就绪');
    } catch (err) {
      console.error('创建学习Agent表失败:', err);
    }
    
    // 验证表是否成功创建
    try {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      console.log('数据库中的表:', tables.map(t => t.name).join(', '));
    } catch (err) {
      console.error('获取表列表失败:', err);
    }
  } catch (error) {
    console.error('数据库初始化失败:', error);
    db = null;
    state.db = null;
    if (mainWindow) {
      mainWindow.webContents.send('databaseInitError', { error: error.message, dbPath: DB_PATH });
    }
  }
  let iconPath;

  if (process.platform === 'win32') {
    iconPath = path.join(__dirname, 'assets', 'icon.ico');
  } else if (process.platform === 'linux') {
    iconPath = path.join(__dirname, 'assets', 'icon.png');
  } else {
    // macOS 通常不需要在 BrowserWindow 中设置图标（使用 .icns + Info.plist）
    iconPath = undefined;
  }
  
  // Create the main window
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 800,
    minWidth: 1200,
    minHeight: 600,
    icon: iconPath, // 你的图标路径
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,
      webSecurity: true, // 启用 webSecurity
    }
  });
  state.mainWindow = mainWindow;
  
  // 检查命令行参数获取开发服务器 URL
  const devServerUrlArg = process.argv.find(arg => arg.startsWith('--devServerUrl='));
  const devServerUrl = devServerUrlArg?.split('=')[1] || null;

  const startUrl = devServerUrl || `file://${path.join(__dirname, 'build', 'index.html')}`;

  console.log('最终加载URL:', startUrl); // 保留此关键日志

  mainWindow.loadURL(startUrl)
    .then(() => {
      console.log(`成功加载URL: ${startUrl}`); // 保留
      if (devServerUrl) {
        mainWindow.webContents.executeJavaScript('document.title')
          .then(title => console.log('开发服务器页面标题:', title))
          .catch(e => console.error('无法获取开发服务器页面标题:', e));
      }
      // 设置 CSP 头
      mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        // 跳过自定义 lep 协议的 CSP 限制，直接返回原始头
        if (details.url.startsWith('lep://')) {
          return callback({ responseHeaders: details.responseHeaders });
        }
        // 对其他请求，添加 CSP，允许 lep: 和 media-src
        const csp = "default-src 'self' lep:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; media-src 'self' lep: data: blob: http://127.0.0.1:* http://localhost:*; frame-src https: http:; child-src https: http:;";
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [csp]
          }
        });
      });
    })
    .catch(err => {
      console.error(`加载URL失败: ${startUrl}`, err); // 保留
    });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('页面加载完成 (did-finish-load)');
    if (mainWindow && !mainWindow.isDestroyed()) {
      // 自动打开 DevTools 与注入 CSS 逻辑已移除
    } else {
       console.warn('尝试在 did-finish-load 中操作，但 mainWindow 已不存在');
    }
  });
  
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('页面加载失败:', errorCode, errorDescription);
  });
  
  mainWindow.on('closed', () => {
    console.log('窗口已关闭');
    mainWindow = null;
    state.mainWindow = null;
  });


  // 打开视频文件函数
  async function openVideoFile() {
    if (!mainWindow) return null;
    
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        defaultPath: store.get('lastVideoDir') || app.getPath('videos'),
        properties: ['openFile'],
        filters: [
          { name: '视频文件', extensions: ['mp4', 'mkv', 'avi', 'mov'] }
        ]
      });
      
      console.log('【主进程】文件选择结果:', result);
      
      if (!result.canceled && result.filePaths.length > 0) {
        const videoPath = result.filePaths[0];
        store.set('lastVideoDir', path.dirname(videoPath));
        const videoName = path.basename(videoPath);
        
        if (mainWindow && !mainWindow.isDestroyed()) {
          
          mainWindow.webContents.send('videoSelectedFromMenu', { 
            success: true, 
            path: videoPath, 
            name: videoName 
          });
        } else {
          console.warn('【主进程】尝试发送 videoSelectedFromMenu 时 mainWindow 不可用');
        }
        return videoPath;
      } else {
        
        return null;
      }
    } catch (error) {
      console.error('【主进程】文件选择对话框出错:', error);
      return null;
    }
  }
  // 定义加载字幕菜单项使用的函数
  async function loadSubtitle() {
    if (!mainWindow) return;
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      defaultPath: store.get('lastVideoDir') || app.getPath('videos'),
      properties: ['openFile'],
      filters: [{ name: '字幕文件', extensions: ['srt', 'vtt', 'ass', 'ssa'] }]
    });
    if (canceled || filePaths.length === 0) return;
    // 调用现有的 loadSubtitle 事件处理逻辑
    ipcMain.emit('loadSubtitle', null, { videoPath: null, subtitlePath: filePaths[0] });
  }

  // 在应用就绪后创建菜单前，添加平台判断
  const isMac = process.platform === 'darwin';

  // --- 定义最终的菜单模板 ---
  const finalMenuTemplate = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' }, // 典型的 macOS 服务菜单
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: '文件', 
      submenu: [
        {
          label: '打开视频...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            await openVideoFile(); // 确保 openVideoFile 函数存在并正确工作
          }
        },
        {
          label: '加载字幕', // 确保 loadSubtitle 函数存在
          accelerator: 'CmdOrCtrl+L',
          click: async () => {
            await loadSubtitle(); // 你的加载字幕逻辑
          }
        },
        { type: 'separator' },
        { // <--- 这是新的 API Key 设置菜单项
          label: '设置 API Key...',
          accelerator: 'CmdOrCtrl+Shift+A', // 可以给一个不同的快捷键
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              
              mainWindow.webContents.send('openApiKeySettings');
            } else {
              console.error('【主进程】尝试发送 openApiKeySettings 时 mainWindow 不可用');
            }
          }
        },
        ...(isMac ? [] : [{ type: 'separator' } , { role: 'quit' }]) // Windows/Linux 的退出
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { role: 'close' }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://mlcore-engine.uk');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(finalMenuTemplate);
  Menu.setApplicationMenu(menu);

  // 检查更新(仅在生产环境)
  if (!process.env.DEV_SERVER_URL) {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

app.on('will-quit', () => {
  console.log('应用即将退出');
  if (db) {
    db.close();
    console.log('数据库连接已关闭');
  }
});

// 监听更新事件
autoUpdater.on('update-available', () => {
  mainWindow.webContents.send('update-available');
});

autoUpdater.on('update-downloaded', () => {
  mainWindow.webContents.send('update-downloaded');
});
