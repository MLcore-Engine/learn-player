/**
 * learningStatsService.js - 学习统计数据服务
 * 从 highlights 表聚合所有统计数据
 */

import { getHighlights } from './highlightService';

/**
 * 获取学习概况
 * @returns {Promise<{
 *   totalHighlights: number,
 *   reviewedHighlights: number,
 *   pendingHighlights: number,
 *   masteredHighlights: number,
 *   reviewRate: number,
 *   totalVideos: number,
 *   todayReviewed: number,
 *   streakDays: number
 * }>}
 */
export async function getLearningOverview() {
  try {
    const result = await getHighlights({ limit: 10000 });
    if (result.error) {
      return { error: result.error };
    }

    const highlights = Array.isArray(result) ? result : [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split('T')[0];

    // 统计各状态数量
    const reviewedHighlights = highlights.filter(h => h.status !== 'pending');
    const pendingHighlights = highlights.filter(h => h.status === 'pending');
    const masteredHighlights = highlights.filter(h => h.status === 'mastered');

    // 计算复习率
    const reviewRate = highlights.length > 0
      ? Math.round((reviewedHighlights.length / highlights.length) * 100)
      : 0;

    // 统计总视频数（unique video_path）
    const uniqueVideos = new Set();
    highlights.forEach(h => {
      if (h.video_path) {
        uniqueVideos.add(h.video_path);
      }
    });

    // todayReviewed：统计 created_at 是今天的数量（只看 reviewed 状态的）
    const todayReviewed = highlights.filter(h => {
      if (h.status === 'pending') return false;
      const createdDate = h.created_at ? h.created_at.split('T')[0] : null;
      return createdDate === todayStart;
    }).length;

    // streakDays：计算连续复习天数（基于 highlights 的 last_review 日期）
    const streakDays = calculateStreakDays(highlights);

    return {
      totalHighlights: highlights.length,
      reviewedHighlights: reviewedHighlights.length,
      pendingHighlights: pendingHighlights.length,
      masteredHighlights: masteredHighlights.length,
      reviewRate,
      totalVideos: uniqueVideos.size,
      todayReviewed,
      streakDays
    };
  } catch (error) {
    console.error('getLearningOverview error:', error);
    return { error: error.message };
  }
}

/**
 * 计算连续复习天数
 * @param {Array} highlights - 高亮列表
 * @returns {number} 连续天数
 */
function calculateStreakDays(highlights) {
  try {
    // 收集所有有 last_review 日期的高亮
    const reviewDates = new Set();
    highlights.forEach(h => {
      if (h.last_review) {
        const date = h.last_review.split('T')[0];
        reviewDates.add(date);
      }
    });

    if (reviewDates.size === 0) return 0;

    // 排序日期
    const sortedDates = Array.from(reviewDates).sort();

    // 从最新日期往前数连续天数
    let streak = 0;
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // 检查最新日期是否是今天或昨天（保证连续性）
    const latestDate = sortedDates[sortedDates.length - 1];
    if (latestDate !== todayStr && latestDate !== yesterdayStr) {
      return 0;
    }

    // 从最新日期往前数
    let currentDate = new Date(latestDate);
    for (const date of sortedDates.reverse()) {
      const checkDateStr = currentDate.toISOString().split('T')[0];
      if (reviewDates.has(checkDateStr)) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  } catch (error) {
    console.error('calculateStreakDays error:', error);
    return 0;
  }
}

/**
 * 获取词频统计
 * @param {number} limit - 返回前 N 个高频词
 * @returns {Promise<Array<{word: string, count: number, avgEase: number}>>}
 */
export async function getWordFrequencyStats(limit = 50) {
  try {
    const result = await getHighlights({ limit: 1000 });
    if (result.error) {
      return { error: result.error };
    }

    const highlights = Array.isArray(result) ? result : [];

    // 在 JS 侧做词频统计：按 original_text 分组
    const wordMap = new Map();

    for (const h of highlights) {
      if (!h.original_text) continue;

      const text = h.original_text.toLowerCase().trim();
      if (!text) continue;

      if (wordMap.has(text)) {
        const entry = wordMap.get(text);
        entry.count++;
        // 累加 ease 用于计算平均
        if (typeof h.ease === 'number') {
          entry.totalEase += h.ease;
          entry.easeCount++;
        }
      } else {
        wordMap.set(text, {
          word: text,
          count: 1,
          totalEase: typeof h.ease === 'number' ? h.ease : 0,
          easeCount: typeof h.ease === 'number' ? 1 : 0
        });
      }
    }

    // 转换为数组并排序
    const sorted = Array.from(wordMap.values())
      .map(entry => ({
        word: entry.word,
        count: entry.count,
        avgEase: entry.easeCount > 0
          ? Math.round((entry.totalEase / entry.easeCount) * 100) / 100
          : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return sorted;
  } catch (error) {
    console.error('getWordFrequencyStats error:', error);
    return { error: error.message };
  }
}

/**
 * 获取学习报告（最近7天每日新增高亮数）
 * @returns {Promise<Array<{date: string, count: number}>>}
 */
export async function getLearningReport() {
  try {
    const result = await getHighlights({ limit: 1000 });
    if (result.error) {
      return { error: result.error };
    }

    const highlights = Array.isArray(result) ? result : [];

    // 计算7天前的时间戳
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // 按日期分组统计
    const dateCountMap = new Map();

    // 初始化最近7天每一天
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dateCountMap.set(dateStr, 0);
    }

    // 过滤并统计
    for (const h of highlights) {
      if (!h.created_at) continue;

      const createdTime = new Date(h.created_at).getTime();
      if (createdTime < sevenDaysAgo) continue;

      const dateStr = h.created_at.split('T')[0];
      if (dateCountMap.has(dateStr)) {
        dateCountMap.set(dateStr, dateCountMap.get(dateStr) + 1);
      }
    }

    // 转换为数组格式并按日期排序
    const report = Array.from(dateCountMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return report;
  } catch (error) {
    console.error('getLearningReport error:', error);
    return { error: error.message };
  }
}
