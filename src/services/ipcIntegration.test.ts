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
function bootstrap(): {
  db: any;
  store: any;
  state: any;
  handlers: Map<string, (e: unknown, p?: unknown) => unknown>;
  listeners: Map<string, (e: unknown, p?: unknown) => void>;
} | null {
  try {
    const dbPath = path.join(os.tmpdir(), `lep-ipc-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    const db = new Database(dbPath);
    db.exec(HIGHLIGHTS_DDL);

    const handlers = new Map<string, (e: unknown, p?: unknown) => unknown>();
    const listeners = new Map<string, (e: unknown, p?: unknown) => void>();
    const makeStore = (): any => {
      const data = new Map<string, unknown>();
      return {
        get: (k: string) => data.get(k),
        set: (k: string, v: unknown) => data.set(k, v),
        delete: (k: string) => data.delete(k),
        store: data
      };
    };
    const store = makeStore();
    const state: any = { db, mainWindow: null };

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
        on: (channel: string, fn: (e: unknown, p?: unknown) => void) => {
          listeners.set(channel, fn);
        },
        removeListener: () => {},
        removeAllListeners: () => {}
      },
      dialog: { showOpenDialog: async () => ({ canceled: true }) },
      BrowserWindow: function BrowserWindowStub() {},
      store,
      state,
      autoUpdater: { on: () => {}, checkForUpdatesAndNotify: async () => {} }
    });

    return { db, store, state, handlers, listeners };
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

/** 调用 ipcMain.on 注册的事件通道（如 loadSubtitle），返回 send 的调用记录 */
const emit = (channel: string, payload?: unknown): any[] => {
  if (!ctx) throw new Error('集成测试上下文未初始化');
  const fn = ctx.listeners.get(channel);
  if (!fn) throw new Error(`listener 未注册: ${channel}`);
  const sent: any[] = [];
  ctx.state.mainWindow = {
    webContents: {
      send: (ch: string, data: unknown) => sent.push({ ch, data })
    }
  };
  fn({}, payload);
  return sent;
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

  describe('submitReview 的 status 状态流转', () => {
    const seed = (over: Record<string, unknown> = {}): void => {
      ctx!.db
        .prepare(
          `INSERT INTO highlights (id, video_path, original_text, explanation, status, ease, interval, repetitions)
           VALUES (?, ?, ?, 'x', ?, 2.5, 0, 0)`
        )
        .run(over.id ?? '1', '/v/a.mp4', over.text ?? 'w', over.status ?? 'learning');
    };

    const statusOf = (id: string): string =>
      (ctx!.db.prepare('SELECT status FROM highlights WHERE id = ?').get(id) as any).status;

    it('首次「良好」→ learning 推进为 reviewed', () => {
      seed();
      const r = invoke('submitReview', { id: '1', quality: 2 });
      expect(r.success).toBe(true);
      expect(r.status).toBe('reviewed');
      expect(statusOf('1')).toBe('reviewed');
    });

    it('连续成功且间隔达标 → mastered', () => {
      // 直接构造一个已接近达标的行，避免在测试里连点十几次
      seed({ status: 'reviewed' });
      ctx!.db
        .prepare('UPDATE highlights SET repetitions = 3, interval = 20, ease = 2.5 WHERE id = ?')
        .run('1');

      const r = invoke('submitReview', { id: '1', quality: 3 });
      expect(r.status).toBe('mastered');
      expect(statusOf('1')).toBe('mastered');
    });

    it('「重来」把 mastered 打回 learning', () => {
      seed({ status: 'mastered' });
      const r = invoke('submitReview', { id: '1', quality: 0 });
      expect(r.status).toBe('learning');
      expect(statusOf('1')).toBe('learning');
      expect(r.srs_data.repetitions).toBe(0);
      expect(r.srs_data.interval).toBe(1);
    });

    it('archived 的词被复习后仍保持 archived', () => {
      seed({ status: 'archived' });
      const r = invoke('submitReview', { id: '1', quality: 3 });
      expect(r.status).toBe('archived');
      expect(statusOf('1')).toBe('archived');
    });

    it('返回体带上 status，前端可据此即时刷新 UI', () => {
      seed();
      const r = invoke('submitReview', { id: '1', quality: 2 });
      expect(Object.keys(r)).toContain('status');
      expect(Object.keys(r)).toContain('srs_data');
    });

    it('status 推进后 getHighlightsStats 立刻能统计到', () => {
      seed({ id: '1', text: 'w1' });
      seed({ id: '2', text: 'w2', status: 'archived' });
      invoke('submitReview', { id: '1', quality: 2 });

      const stats = invoke('getHighlightsStats');
      expect(stats.reviewedHighlights).toBe(1);
      expect(stats.archivedHighlights).toBe(1);
      expect(stats.masteredHighlights).toBe(0);
    });
  });

  describe('getDueHighlights 的 excludeStatus', () => {
    const seed = (id: string, status: string, nextReview: string | null): void => {
      ctx!.db
        .prepare(
          `INSERT INTO highlights (id, video_path, original_text, status, next_review)
           VALUES (?, '/v/a.mp4', ?, ?, ?)`
        )
        .run(id, `w-${id}`, status, nextReview);
    };

    it('excludeStatus=archived 会排除归档词，其余到期词都返回', () => {
      seed('1', 'learning', null);
      seed('2', 'reviewed', null);
      seed('3', 'mastered', null);
      seed('4', 'archived', null);

      const r = invoke('getDueHighlights', { limit: 20, excludeStatus: 'archived' }) as any[];
      expect(r.map((x) => x.id).sort()).toEqual(['1', '2', '3']);
    });

    it('回归：reviewed/mastered 但已到期的词不能被漏掉', () => {
      // 这正是原先 status=learning 过滤会踩的坑
      seed('1', 'reviewed', '2020-01-01T00:00:00.000Z');
      seed('2', 'mastered', '2020-01-01T00:00:00.000Z');

      const r = invoke('getDueHighlights', { limit: 20, excludeStatus: 'archived' }) as any[];
      expect(r).toHaveLength(2);
    });

    it('未到期的词不进入队列', () => {
      seed('1', 'learning', '2099-01-01T00:00:00.000Z');
      const r = invoke('getDueHighlights', { limit: 20, excludeStatus: 'archived' }) as any[];
      expect(r).toHaveLength(0);
    });

    it('不带 excludeStatus 时返回全部到期词（含 archived）', () => {
      seed('1', 'learning', null);
      seed('2', 'archived', null);
      const r = invoke('getDueHighlights', { limit: 20 }) as any[];
      expect(r).toHaveLength(2);
    });
  });

  describe('loadSubtitle', () => {
    // 注意：随机后缀必须加在扩展名之后，否则 path.extname() 取不到 .srt/.ass
    const write = (ext: string, content: string): string => {
      const p2 = path.join(
        os.tmpdir(),
        `lep-sub-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
      );
      fs.writeFileSync(p2, content);
      return p2;
    };

    it('.srt 正常解析并回传字幕', () => {
      const f = write('.srt', '1\n00:00:01,000 --> 00:00:03,000\nHello world\n');
      const sent = emit('loadSubtitle', { subtitlePath: f });
      expect(sent[0].data.success).toBe(true);
      expect(sent[0].data.subtitles).toHaveLength(1);
      expect(sent[0].data.subtitles[0].data.text).toBe('Hello world');
      fs.unlinkSync(f);
    });

    it('.vtt 正常解析并回传字幕', () => {
      const f = write('.vtt', 'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nHello vtt\n');
      const sent = emit('loadSubtitle', { subtitlePath: f });
      expect(sent[0].data.success).toBe(true);
      fs.unlinkSync(f);
    });

    it('.ass 给出可操作的错误提示，而不是解析器的怪话', () => {
      // 回归：此前 ass/ssa 会走 parseSync，抛
      // "expected timestamp at row 1, but received: [Script Info]"
      const f = write('.ass', '[Script Info]\nDialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Hi\n');
      const sent = emit('loadSubtitle', { subtitlePath: f });
      expect(sent[0].data.success).toBe(false);
      expect(sent[0].data.error).toBe('暂不支持 ASS/SSA 字幕，请先转换为 SRT 或 VTT 格式');
      fs.unlinkSync(f);
    });

    it('.ssa 同样被拦截', () => {
      const f = write('.ssa', '[Script Info]\n');
      const sent = emit('loadSubtitle', { subtitlePath: f });
      expect(sent[0].data.success).toBe(false);
      expect(sent[0].data.error).toContain('ASS/SSA');
      fs.unlinkSync(f);
    });

    it('路径为空时返回引导性错误', () => {
      const sent = emit('loadSubtitle', { subtitlePath: '' });
      expect(sent[0].data.success).toBe(false);
      expect(sent[0].data.error).toBe('请手动选择有效的字幕文件');
    });

    it('文件不存在时返回引导性错误', () => {
      const sent = emit('loadSubtitle', { subtitlePath: '/no/such/file.srt' });
      expect(sent[0].data.success).toBe(false);
    });
  });

  describe('字典状态与自选文件', () => {
    it('默认（未配置）时 isCustom=false 且指向默认路径', () => {
      const r = invoke('getDictionaryStatus');
      expect(r.isCustom).toBe(false);
      expect(r.exists).toBe(false); // 仓库里没有随附 .mdx
      expect(r.defaultPath).toContain('resources');
      expect(r.path).toBe(r.defaultPath);
    });

    it('用户取消选择时返回 canceled，不修改配置', async () => {
      const r = await invoke('selectDictionaryFile');
      expect(r.canceled).toBe(true);
      expect(ctx!.store.get('dictionaryPath')).toBeUndefined();
    });

    it('自定义路径指向不存在的文件时，回退到默认路径', () => {
      ctx!.store.set('dictionaryPath', '/definitely/not/here.mdx');
      const r = invoke('getDictionaryStatus');
      expect(r.isCustom).toBe(false);
      expect(r.path).toBe(r.defaultPath);
      ctx!.store.delete('dictionaryPath');
    });

    it('自定义路径存在时 isCustom=true', () => {
      const fake = path.join(os.tmpdir(), `fake-dict-${Date.now()}.mdx`);
      fs.writeFileSync(fake, 'x');
      ctx!.store.set('dictionaryPath', fake);

      const r = invoke('getDictionaryStatus');
      expect(r.isCustom).toBe(true);
      expect(r.path).toBe(fake);
      expect(r.exists).toBe(true);

      ctx!.store.delete('dictionaryPath');
      fs.unlinkSync(fake);
    });

    it('字典缺失时 lookupWord 返回明确错误而不是抛异常', async () => {
      ctx!.store.delete('dictionaryPath');
      const r = await invoke('lookupWord', 'glimpse');
      expect(r.success).toBe(false);
      expect(r.error).toBe('字典文件不存在');
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
