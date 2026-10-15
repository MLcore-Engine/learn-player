/**
 * 主进程 IPC handler 集成测试（真实 SQLite，非 mock）
 *
 * 直接 require 生产代码 main/ipc/index.js，用注入的假 ipcMain 捕获 handler，
 * 再对真实 better-sqlite3 数据库调用它们。覆盖新增的 findHighlight（AI 讲解
 * 缓存的数据基础）以及 createHighlight 的 UPSERT 语义。
 *
 * 运行：CI=true npm test -- --testPathPattern=ipcIntegration
 *
 * 注意：better-sqlite3 是原生模块。项目的 postinstall 会按 Electron ABI 编译它，
 * 而 jest 跑在纯 Node 下，两者 ABI 不同，可能出现「Could not locate the bindings
 * file」。此时本文件整体跳过（不会让 npm test 失败）。如需启用：
 *
 *     npm rebuild better-sqlite3
 *
 * @jest-environment node
 */
jest.useFakeTimers();

// videoFrameExtractor 会 require('electron')，这里必须打桩
jest.mock('electron', () => ({
  app: {
    getPath: () => require('os').tmpdir(),
    getVersion: () => '1.1.0',
    on: () => {},
    whenReady: () => Promise.resolve()
  },
  ipcMain: { handle: () => {} },
  dialog: {},
  BrowserWindow: {}
}));

// axios v1 是纯 ESM，jest 默认不转译 node_modules，打桩掉。
// 本测试只碰 DB 相关 handler，不会真的发 HTTP。
jest.mock('axios', () => ({
  __esModule: true,
  default: { post: async () => ({ data: {} }) },
  post: async () => ({ data: {} })
}));

const fs = require('fs');
const os = require('os');
const path = require('path');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Database = require('better-sqlite3');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { registerIpcHandlers } = require('../../main/ipc/index.js');

const HIGHLIGHTS_DDL = `
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
`;

/** 在模块加载时就探测原生绑定，决定后续用例是跑还是跳过 */
function bootstrap(): { db: any; handlers: Map<string, (e: unknown, p?: unknown) => unknown> } | null {
  try {
    const dbPath = path.join(os.tmpdir(), `lep-ipc-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    const db = new Database(dbPath);
    db.exec(HIGHLIGHTS_DDL);

    const handlers = new Map<string, (e: unknown, p?: unknown) => unknown>();
    const makeStore = (): any => {
      const data = new Map<string, unknown>();
      return {
        get: (k: string) => data.get(k),
        set: (k: string, v: unknown) => data.set(k, v),
        delete: (k: string) => data.delete(k),
        store: data
      };
    };

    registerIpcHandlers({
      app: {
        getPath: () => os.tmpdir(),
        getVersion: () => '1.1.0',
        on: () => {},
        whenReady: () => Promise.resolve()
      },
      ipcMain: {
        handle: (channel: string, fn: (e: unknown, p?: unknown) => unknown) => {
          handlers.set(channel, fn);
        },
        // registerIpcHandlers 里还用 ipcMain.on 注册了 loadSubtitle 等事件
        on: () => {},
        removeListener: () => {},
        removeAllListeners: () => {}
      },
      dialog: { showOpenDialog: async () => ({ canceled: true }) },
      BrowserWindow: function BrowserWindowStub() {},
      store: makeStore(),
      state: { db, mainWindow: null },
      autoUpdater: { on: () => {}, checkForUpdatesAndNotify: async () => {} }
    });

    return { db, handlers };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(
      '[ipcIntegration] better-sqlite3 原生绑定不可用，跳过集成测试。\n' +
        '如需启用：npm rebuild better-sqlite3\n' +
        `原因: ${(e as Error).message}`
    );
    return null;
  }
}

const ctx = bootstrap();
const d: typeof describe = ctx ? describe : describe.skip;

const invoke = (channel: string, payload?: unknown): any => {
  if (!ctx) throw new Error('集成测试上下文未初始化');
  const h = ctx.handlers.get(channel);
  if (!h) throw new Error(`handler 未注册: ${channel}`);
  return h({}, payload);
};

d('主进程 IPC 集成测试', () => {
  beforeEach(() => {
    ctx?.db.exec('DELETE FROM highlights');
  });

  afterAll(() => {
    try {
      ctx?.db.close();
    } catch {
      /* ignore */
    }
  });

  describe('findHighlight（AI 讲解缓存的数据基础）', () => {
    it('同视频同文本能命中', () => {
      ctx!.db
        .prepare(
          `INSERT INTO highlights (id, video_path, original_text, explanation)
           VALUES ('1', '/v/a.mp4', 'glimpse', '旧讲解')`
        )
        .run();

      const r = invoke('findHighlight', { videoPath: '/v/a.mp4', text: 'glimpse' });
      expect(r).not.toBeNull();
      expect(r.explanation).toBe('旧讲解');
    });

    it('文本不同 → 未命中', () => {
      ctx!.db
        .prepare(
          `INSERT INTO highlights (id, video_path, original_text, explanation)
           VALUES ('1', '/v/a.mp4', 'glimpse', '旧讲解')`
        )
        .run();

      expect(invoke('findHighlight', { videoPath: '/v/a.mp4', text: 'detailed' })).toBeNull();
    });

    it('视频不同 → 未命中（UNIQUE 键是 video_path + original_text 组合）', () => {
      ctx!.db
        .prepare(
          `INSERT INTO highlights (id, video_path, original_text, explanation)
           VALUES ('1', '/v/a.mp4', 'glimpse', '旧讲解')`
        )
        .run();

      expect(invoke('findHighlight', { videoPath: '/v/b.mp4', text: 'glimpse' })).toBeNull();
    });

    it('OCR 场景 video_path 为空串时也能命中', () => {
      ctx!.db
        .prepare(
          `INSERT INTO highlights (id, video_path, original_text, explanation)
           VALUES ('1', '', 'screen text', 'OCR 讲解')`
        )
        .run();

      const r = invoke('findHighlight', { videoPath: '', text: 'screen text' });
      expect(r && r.explanation).toBe('OCR 讲解');
    });

    it('videoPath 缺省时按空串查询，不报错', () => {
      expect(() => invoke('findHighlight', { text: 'x' })).not.toThrow();
    });

    it('库为空时返回 null 而不是报错', () => {
      expect(invoke('findHighlight', { videoPath: '/v/a.mp4', text: 'none' })).toBeNull();
    });
  });

  describe('createHighlight 的 UPSERT 语义', () => {
    it('首次插入生成新行，query_count = 1', () => {
      invoke('createHighlight', {
        video_path: '/v/a.mp4',
        original_text: 'glimpse',
        explanation: '讲解 A',
        status: 'learning'
      });

      const row = ctx!.db.prepare('SELECT * FROM highlights').get() as any;
      expect(row.query_count).toBe(1);
      expect(row.explanation).toBe('讲解 A');
      expect(row.status).toBe('learning');
    });

    it('同键重复插入只更新不新增，且 query_count 自增', () => {
      invoke('createHighlight', { video_path: '/v/a.mp4', original_text: 'glimpse', explanation: '讲解 A' });
      invoke('createHighlight', { video_path: '/v/a.mp4', original_text: 'glimpse', explanation: '讲解 B' });

      const rows = ctx!.db.prepare('SELECT * FROM highlights').all() as any[];
      expect(rows).toHaveLength(1);
      expect(rows[0].query_count).toBe(2);
      expect(rows[0].explanation).toBe('讲解 B');
    });

    it('不同视频同文本是两行', () => {
      invoke('createHighlight', { video_path: '/v/a.mp4', original_text: 'glimpse', explanation: 'A' });
      invoke('createHighlight', { video_path: '/v/b.mp4', original_text: 'glimpse', explanation: 'B' });

      expect((ctx!.db.prepare('SELECT * FROM highlights').all() as any[]).length).toBe(2);
    });
  });

  describe('端到端：讲解缓存全流程', () => {
    it('第一次讲解写入 → 第二次同文本查询直接命中缓存', () => {
      // 第一次：AI 流式讲解后落库
      invoke('createHighlight', {
        video_path: '/v/movie.mp4',
        original_text: 'serendipity',
        explanation: '**serendipity** /ˌsɛrənˈdɪpəti/ n. 意外发现',
        status: 'learning'
      });

      // 第二次：handleExplain 会先查缓存
      const cached = invoke('findHighlight', { videoPath: '/v/movie.mp4', text: 'serendipity' });
      expect(cached).not.toBeNull();
      expect(cached.explanation).toContain('serendipity');

      // 命中后仍 UPSERT 一次，query_count 变为 2
      invoke('createHighlight', {
        video_path: '/v/movie.mp4',
        original_text: 'serendipity',
        explanation: cached.explanation,
        status: 'learning'
      });

      const row = ctx!.db.prepare('SELECT * FROM highlights').get() as any;
      expect(row.query_count).toBe(2);
    });

    it('缓存命中不应受 status 影响（archived 的词也能复用讲解）', () => {
      invoke('createHighlight', {
        video_path: '/v/a.mp4',
        original_text: 'word',
        explanation: '讲解',
        status: 'archived'
      });

      const r = invoke('findHighlight', { videoPath: '/v/a.mp4', text: 'word' });
      expect(r && r.explanation).toBe('讲解');
    });
  });

  describe('getHighlightsStats', () => {
    it('按 status 统计各状态数量', () => {
      const ins = ctx!.db.prepare(
        `INSERT INTO highlights (id, video_path, original_text, explanation, status)
         VALUES (?, ?, ?, 'x', ?)`
      );
      ins.run('1', '/v/a.mp4', 'w1', 'learning');
      ins.run('2', '/v/a.mp4', 'w2', 'learning');
      ins.run('3', '/v/a.mp4', 'w3', 'mastered');
      ins.run('4', '/v/a.mp4', 'w4', 'archived');
      ins.run('5', '/v/b.mp4', 'w5', 'reviewed');

      const stats = invoke('getHighlightsStats');
      expect(stats.error).toBeUndefined();
      expect(stats.totalHighlights).toBe(5);
      expect(stats.masteredHighlights).toBe(1);
      expect(stats.archivedHighlights).toBe(1);
      expect(stats.totalVideos).toBe(2);
    });
  });
});
