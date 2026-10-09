/**
 * learningStats 纯函数单测。
 * 运行：CI=true npm test -- --testPathPattern=learningStats
 */
import {
  buildMasteryDistribution,
  calcMasteryRate,
  calcPlanDayIndex,
  calcPlanProgress,
  formatDuration
} from './learningStats';
import type { HighlightsStats } from '../types/highlight';

const STATS: HighlightsStats = {
  totalHighlights: 100,
  pendingHighlights: 40,
  reviewedHighlights: 30,
  archivedHighlights: 10,
  masteredHighlights: 20,
  totalVideos: 3,
  todayReviewed: 5,
  streakDays: 4
};

describe('buildMasteryDistribution', () => {
  it('按四个状态拆分并计算百分比', () => {
    const { total, segments } = buildMasteryDistribution(STATS);

    expect(total).toBe(100);
    expect(segments.map((s) => s.level)).toEqual(['learning', 'reviewed', 'mastered', 'archived']);
    expect(segments.map((s) => s.count)).toEqual([40, 30, 20, 10]);
    expect(segments.map((s) => s.percent)).toEqual([40, 30, 20, 10]);
    expect(segments.map((s) => s.label)).toEqual(['学习中', '已复习', '已掌握', '已归档']);
  });

  it('百分比之和为 100（可四舍五入误差 ±1）', () => {
    const { segments } = buildMasteryDistribution({ ...STATS, totalHighlights: 3, pendingHighlights: 1, reviewedHighlights: 1, archivedHighlights: 0, masteredHighlights: 1 });
    const sum = segments.reduce((acc, s) => acc + s.percent, 0);
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(1);
  });

  it('pending 缺失时用总数回推 learning，且不为负', () => {
    const { segments } = buildMasteryDistribution({
      totalHighlights: 10,
      reviewedHighlights: 4,
      archivedHighlights: 1,
      masteredHighlights: 2
    });
    expect(segments[0]).toMatchObject({ level: 'learning', count: 3, percent: 30 });
  });

  it('后端数据不一致导致回推值为负时钳制为 0', () => {
    const { segments } = buildMasteryDistribution({
      totalHighlights: 10,
      reviewedHighlights: 8,
      archivedHighlights: 5,
      masteredHighlights: 5
    });
    expect(segments[0].count).toBe(0);
    expect(segments[0].percent).toBe(0);
  });

  it('total 为 0 时全部为 0', () => {
    const { total, segments } = buildMasteryDistribution({ ...STATS, totalHighlights: 0 });
    expect(total).toBe(0);
    expect(segments.every((s) => s.count === 0 && s.percent === 0)).toBe(true);
  });

  it('入参为 null / undefined 时不抛错', () => {
    expect(buildMasteryDistribution(null).total).toBe(0);
    expect(buildMasteryDistribution(undefined).segments).toHaveLength(4);
  });

  it('负数字段被钳制为 0', () => {
    const { segments } = buildMasteryDistribution({ totalHighlights: -5, pendingHighlights: -1 });
    expect(segments.every((s) => s.count === 0)).toBe(true);
  });
});

describe('calcMasteryRate', () => {
  it('正常计算掌握率', () => {
    expect(calcMasteryRate(STATS)).toBe(20);
  });

  it('总数为 0 时返回 0 而不是 NaN', () => {
    expect(calcMasteryRate({ totalHighlights: 0, masteredHighlights: 0 })).toBe(0);
    expect(calcMasteryRate(null)).toBe(0);
  });

  it('全部掌握时为 100', () => {
    expect(calcMasteryRate({ totalHighlights: 7, masteredHighlights: 7 })).toBe(100);
  });
});

describe('formatDuration', () => {
  it('按小时/分钟格式化', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(-10)).toBe('0m');
    expect(formatDuration(59)).toBe('0m');
    expect(formatDuration(60)).toBe('1m');
    expect(formatDuration(3600)).toBe('1h 0m');
    expect(formatDuration(3900)).toBe('1h 5m');
  });
});

describe('calcPlanDayIndex', () => {
  const daysAgo = (n: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
  };

  it('当天创建 → 第 1 天', () => {
    expect(calcPlanDayIndex(new Date().toISOString(), 7)).toBe(1);
  });

  it('3 天前创建 → 第 4 天', () => {
    expect(calcPlanDayIndex(daysAgo(3), 7)).toBe(4);
  });

  it('超过计划天数时钳制在 days', () => {
    expect(calcPlanDayIndex(daysAgo(30), 7)).toBe(7);
  });

  it('createdAt 缺失或非法时返回 1', () => {
    expect(calcPlanDayIndex(undefined, 7)).toBe(1);
    expect(calcPlanDayIndex('not-a-date', 7)).toBe(1);
  });

  it('days 非法时按 1 天处理', () => {
    expect(calcPlanDayIndex(daysAgo(5), 0)).toBe(1);
    expect(calcPlanDayIndex(daysAgo(5), Number.NaN)).toBe(1);
  });
});

describe('calcPlanProgress', () => {
  it('按天推算百分比', () => {
    expect(calcPlanProgress(1, 7)).toBe(14);
    expect(calcPlanProgress(4, 7)).toBe(57);
    expect(calcPlanProgress(7, 7)).toBe(100);
  });

  it('越界值被钳制', () => {
    expect(calcPlanProgress(0, 7)).toBe(14);
    expect(calcPlanProgress(99, 7)).toBe(100);
    expect(calcPlanProgress(3, 0)).toBe(100);
  });
});
