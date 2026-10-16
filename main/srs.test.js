/**
 * main/srs.js 单元测试（纯函数，零依赖，无需 mock electron）
 *
 * 运行：CI=true npm test -- --testPathPattern=main/srs
 *
 * 注意：主进程约定是纯 JS，所以这里也用 CJS + 无类型注解。
 */
const {
  calculateSM2,
  nextReviewStatus,
  REVIEW_QUALITY,
  HIGHLIGHT_STATUS,
  MASTERY_MIN_REPETITIONS,
  MASTERY_MIN_INTERVAL_DAYS
} = require('./srs.js');

const base = (over = {}) => ({
  ease: 2.5,
  interval: 0,
  repetitions: 0,
  ...over
});

const daysFromNow = (iso) => Math.round((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000));

describe('calculateSM2', () => {
  it('首次「良好」：interval=1，repetitions=1', () => {
    const r = calculateSM2(base(), REVIEW_QUALITY.GOOD);
    expect(r.repetitions).toBe(1);
    expect(r.interval).toBe(1);
    expect(daysFromNow(r.next_review)).toBe(1);
  });

  it('第二次「良好」：interval=6', () => {
    const r = calculateSM2(base({ repetitions: 1, interval: 1 }), REVIEW_QUALITY.GOOD);
    expect(r.repetitions).toBe(2);
    expect(r.interval).toBe(6);
  });

  it('第三次及以后：interval = round(interval * ease)', () => {
    const r = calculateSM2(base({ repetitions: 2, interval: 6, ease: 2.5 }), REVIEW_QUALITY.GOOD);
    expect(r.interval).toBe(15);
    expect(r.repetitions).toBe(3);
  });

  it('「重来」(0) 重置 repetitions 与 interval', () => {
    const r = calculateSM2(base({ repetitions: 5, interval: 40, ease: 2.6 }), REVIEW_QUALITY.BLACKOUT);
    expect(r.repetitions).toBe(0);
    expect(r.interval).toBe(1);
  });

  it('「困难」(1) 同样重置（本实现把 <2 都当作重新开始）', () => {
    const r = calculateSM2(base({ repetitions: 3, interval: 20 }), REVIEW_QUALITY.HARD);
    expect(r.repetitions).toBe(0);
    expect(r.interval).toBe(1);
  });

  it('ease 下限为 1.3', () => {
    let h = base({ ease: 1.3 });
    for (let i = 0; i < 10; i++) h = calculateSM2(h, REVIEW_QUALITY.BLACKOUT);
    expect(h.ease).toBe(1.3);
  });

  it('「简单」比「良好」提升更多 ease', () => {
    const good = calculateSM2(base({ ease: 2.5 }), REVIEW_QUALITY.GOOD);
    const easy = calculateSM2(base({ ease: 2.5 }), REVIEW_QUALITY.EASY);
    expect(easy.ease).toBeGreaterThan(good.ease);
  });

  it('ease 单调性：连续「简单」逐步升高', () => {
    let h = base();
    const seq = [];
    for (let i = 0; i < 4; i++) {
      h = calculateSM2(h, REVIEW_QUALITY.EASY);
      seq.push(h.ease);
    }
    for (let i = 1; i < seq.length; i++) {
      expect(seq[i]).toBeGreaterThan(seq[i - 1]);
    }
  });
});

describe('nextReviewStatus', () => {
  it('重来(0) → 一律回退 learning', () => {
    expect(nextReviewStatus('mastered', 0, 0, 1)).toBe('learning');
    expect(nextReviewStatus('reviewed', 0, 0, 1)).toBe('learning');
    expect(nextReviewStatus('learning', 0, 0, 1)).toBe('learning');
  });

  it('成功一次 → reviewed', () => {
    expect(nextReviewStatus('learning', 2, 1, 1)).toBe('reviewed');
    expect(nextReviewStatus('learning', 3, 1, 1)).toBe('reviewed');
  });

  it('未成功过 → learning（守住边界，避免脏数据把状态推错）', () => {
    expect(nextReviewStatus('learning', 2, 0, 1)).toBe('learning');
  });

  it('连续成功次数与间隔同时达标 → mastered', () => {
    expect(nextReviewStatus('reviewed', 2, MASTERY_MIN_REPETITIONS, MASTERY_MIN_INTERVAL_DAYS)).toBe('mastered');
    expect(nextReviewStatus('reviewed', 3, MASTERY_MIN_REPETITIONS + 2, MASTERY_MIN_INTERVAL_DAYS + 10)).toBe('mastered');
  });

  it('次数达标但间隔不够 → 仍是 reviewed', () => {
    expect(nextReviewStatus('reviewed', 2, MASTERY_MIN_REPETITIONS, 15)).toBe('reviewed');
  });

  it('间隔达标但次数不够 → 仍是 reviewed', () => {
    expect(nextReviewStatus('reviewed', 2, MASTERY_MIN_REPETITIONS - 1, 60)).toBe('reviewed');
  });

  it('archived 是终态，不参与自动流转', () => {
    expect(nextReviewStatus('archived', 0, 0, 1)).toBe('archived');
    expect(nextReviewStatus('archived', 2, 5, 100)).toBe('archived');
    expect(nextReviewStatus('archived', 3, 9, 365)).toBe('archived');
  });

  it('status 缺省/未知值不抛错', () => {
    expect(nextReviewStatus(undefined, 2, 1, 1)).toBe('reviewed');
    expect(nextReviewStatus(null, 2, 1, 1)).toBe('reviewed');
    expect(nextReviewStatus('whatever', 0, 0, 1)).toBe('learning');
  });
});

describe('真实学习路径模拟', () => {
  it('连续 4 次「良好」后应达到 mastered', () => {
    let h = base();
    let status = HIGHLIGHT_STATUS.LEARNING;
    const trace = [];

    for (let i = 1; i <= 6; i++) {
      const r = calculateSM2(h, REVIEW_QUALITY.GOOD);
      status = nextReviewStatus(status, REVIEW_QUALITY.GOOD, r.repetitions, r.interval);
      trace.push({ n: i, interval: r.interval, status });
      h = { ...h, ...r };
    }

    // 1: rep1/int1   reviewed
    // 2: rep2/int6   reviewed
    // 3: rep3/int15  reviewed（间隔未到 21）
    // 4: rep4/int38  mastered
    expect(trace[0].status).toBe('reviewed');
    expect(trace[1].status).toBe('reviewed');
    expect(trace[2].status).toBe('reviewed');
    expect(trace[3].status).toBe('mastered');
  });

  it('中途一次「重来」会把状态打回 learning 并重新计数', () => {
    let h = base();
    let status = HIGHLIGHT_STATUS.LEARNING;

    for (let i = 0; i < 3; i++) {
      const r = calculateSM2(h, REVIEW_QUALITY.GOOD);
      status = nextReviewStatus(status, REVIEW_QUALITY.GOOD, r.repetitions, r.interval);
      h = { ...h, ...r };
    }
    expect(status).toBe('reviewed');

    const r = calculateSM2(h, REVIEW_QUALITY.BLACKOUT);
    status = nextReviewStatus(status, REVIEW_QUALITY.BLACKOUT, r.repetitions, r.interval);
    expect(status).toBe('learning');
    expect(r.repetitions).toBe(0);
    expect(r.interval).toBe(1);
  });
});
