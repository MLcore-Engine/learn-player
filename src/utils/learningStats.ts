/**
 * 学习统计的纯计算工具。
 *
 * 单独抽成模块是为了可单测：组件只负责渲染，比例/文案计算在这里完成。
 */
import type { HighlightsStats } from '../types/highlight';

export type MasteryLevel = 'learning' | 'reviewed' | 'mastered' | 'archived';

export interface MasterySegment {
  level: MasteryLevel;
  label: string;
  count: number;
  /** 占总数的百分比，0-100，已四舍五入 */
  percent: number;
}

export interface MasteryDistribution {
  total: number;
  segments: MasterySegment[];
}

const LEVEL_LABEL: Record<MasteryLevel, string> = {
  learning: '学习中',
  reviewed: '已复习',
  mastered: '已掌握',
  archived: '已归档'
};

/**
 * 把 HighlightsStats 拆成四个状态的占比。
 *
 * - `pendingHighlights` 在语义上等价于「学习中」（未进入复习队列），
 *   因此 learning 段取 max(pending, total - reviewed - archived - mastered)，
 *   避免后端两个字段不同步时出现负值。
 * - total 为 0 时返回全 0 段，percent 全为 0。
 */
export const buildMasteryDistribution = (
  stats: Partial<HighlightsStats> | null | undefined
): MasteryDistribution => {
  const total = Math.max(0, stats?.totalHighlights ?? 0);

  // total 为 0 说明没有任何数据（或后端字段不一致），直接返回全 0，
  // 避免出现「总数 0 但学习中 40」这种自相矛盾的展示。
  if (total === 0) {
    return {
      total: 0,
      segments: (['learning', 'reviewed', 'mastered', 'archived'] as MasteryLevel[]).map((level) => ({
        level,
        label: LEVEL_LABEL[level],
        count: 0,
        percent: 0
      }))
    };
  }

  const reviewed = Math.max(0, stats?.reviewedHighlights ?? 0);
  const archived = Math.max(0, stats?.archivedHighlights ?? 0);
  const mastered = Math.max(0, stats?.masteredHighlights ?? 0);
  const learning = Math.max(0, stats?.pendingHighlights ?? total - reviewed - archived - mastered);

  const raw: Array<{ level: MasteryLevel; count: number }> = [
    { level: 'learning', count: learning },
    { level: 'reviewed', count: reviewed },
    { level: 'mastered', count: mastered },
    { level: 'archived', count: archived }
  ];

  const segments: MasterySegment[] = raw.map(({ level, count }) => ({
    level,
    label: LEVEL_LABEL[level],
    count,
    percent: total > 0 ? Math.round((count / total) * 100) : 0
  }));

  return { total, segments };
};

/** 掌握率：已掌握 / 总数，总数 0 时返回 0 */
export const calcMasteryRate = (stats: Partial<HighlightsStats> | null | undefined): number => {
  const total = stats?.totalHighlights ?? 0;
  if (total <= 0) return 0;
  return Math.round(((stats?.masteredHighlights ?? 0) / total) * 100);
};

/** 把秒数格式化成 "1h 5m" / "42m" */
export const formatDuration = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

/**
 * 根据计划创建时间推算「今天是第几天」。
 * 返回 1..days 之间的整数；createdAt 缺失或非法时返回 1。
 */
export const calcPlanDayIndex = (createdAt: string | undefined, days: number): number => {
  const safeDays = Math.max(1, Math.floor(days) || 1);
  if (!createdAt) return 1;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return 1;

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  // 用本地日期比较，避免时区把「今天生成的计划」算成第 0 天或第 2 天
  const startOfDay = (ts: number): number => {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const diffDays = Math.floor((startOfDay(Date.now()) - startOfDay(created)) / MS_PER_DAY);
  return Math.min(Math.max(diffDays + 1, 1), safeDays);
};

/** 由「第几天」推算完成进度百分比 */
export const calcPlanProgress = (dayIndex: number, days: number): number => {
  const safeDays = Math.max(1, Math.floor(days) || 1);
  const safeDay = Math.min(Math.max(Math.floor(dayIndex) || 1, 1), safeDays);
  return Math.round((safeDay / safeDays) * 100);
};
