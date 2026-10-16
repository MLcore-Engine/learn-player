/**
 * srs.js — SM-2 间隔重复算法 + 学习状态流转（纯函数，无 IO，可单测）
 *
 * 从 main/ipc/index.js 抽出，原因是原实现内联在 registerIpcHandlers 里，
 * 要测它必须把整套 IPC + electron + axios 都 mock 掉。抽出来后这里是零依赖的
 * 纯计算，测试可以直接 require。
 */

/** 复习评分：0=重来 1=困难 2=良好 3=简单 */
const REVIEW_QUALITY = {
  BLACKOUT: 0,
  HARD: 1,
  GOOD: 2,
  EASY: 3
};

/** highlights.status 取值 */
const HIGHLIGHT_STATUS = {
  LEARNING: 'learning',
  REVIEWED: 'reviewed',
  MASTERED: 'mastered',
  ARCHIVED: 'archived'
};

/** 判定「已掌握」的门槛：连续成功次数 与 当前间隔天数 */
const MASTERY_MIN_REPETITIONS = 3;
const MASTERY_MIN_INTERVAL_DAYS = 21;

const MIN_EASE = 1.3;

/**
 * SM-2 核心计算。输入一行 highlight 的 SRS 字段和本次评分，输出新的调度值。
 *
 * 与原实现的差异：无。这里保持逐行一致的语义，只是搬了位置。
 *   - quality < 2（重来/困难）：repetitions 归零、interval 重置为 1 天
 *   - quality >= 2（良好/简单）：repetitions +1，interval 按 1 → 6 → interval*ease 推进
 *   - ease 按 SM-2 公式调整，下限 1.3
 */
function calculateSM2(highlight, quality) {
  let { ease, interval, repetitions } = highlight;

  if (quality < REVIEW_QUALITY.GOOD) {
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * ease);
    repetitions += 1;
  }

  ease = ease + (0.1 - (3 - quality) * (0.08 + (3 - quality) * 0.02));
  if (ease < MIN_EASE) ease = MIN_EASE;

  const next_review = new Date();
  next_review.setDate(next_review.getDate() + interval);

  return {
    ease,
    interval,
    repetitions,
    next_review: next_review.toISOString()
  };
}

/**
 * 根据本次复习结果推算下一个 status。
 *
 * 状态机：learning → reviewed → mastered
 *   - quality=0（重来）：任何状态都回退到 learning（说明还没记住）
 *   - 连续成功次数与间隔同时达标 → mastered
 *   - 至少成功过一次 → reviewed
 *   - 其余 → learning
 *
 * archived 是用户主动归档的终态，不参与自动流转 —— 否则归档的词会被
 * 一次复习重新拉回学习队列。
 */
function nextReviewStatus(currentStatus, quality, repetitions, interval) {
  if (currentStatus === HIGHLIGHT_STATUS.ARCHIVED) {
    return HIGHLIGHT_STATUS.ARCHIVED;
  }
  if (quality === REVIEW_QUALITY.BLACKOUT) {
    return HIGHLIGHT_STATUS.LEARNING;
  }
  if (repetitions >= MASTERY_MIN_REPETITIONS && interval >= MASTERY_MIN_INTERVAL_DAYS) {
    return HIGHLIGHT_STATUS.MASTERED;
  }
  if (repetitions >= 1) {
    return HIGHLIGHT_STATUS.REVIEWED;
  }
  return HIGHLIGHT_STATUS.LEARNING;
}

module.exports = {
  REVIEW_QUALITY,
  HIGHLIGHT_STATUS,
  MASTERY_MIN_REPETITIONS,
  MASTERY_MIN_INTERVAL_DAYS,
  calculateSM2,
  nextReviewStatus
};
