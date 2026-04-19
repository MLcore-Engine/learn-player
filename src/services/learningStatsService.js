/**
 * learningStatsService.js - 学习统计数据服务
 * 从 highlights 表聚合所有统计数据
 */

import { ipcClient } from './ipcClient';

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
    const stats = await ipcClient.getHighlightsStats();
    if (stats.error) {
      return { error: stats.error };
    }

    const { totalHighlights, pendingHighlights, reviewedHighlights, masteredHighlights, totalVideos, todayReviewed, streakDays } = stats;
    const reviewRate = totalHighlights > 0
      ? Math.round((reviewedHighlights / totalHighlights) * 100)
      : 0;

    return {
      totalHighlights,
      reviewedHighlights,
      pendingHighlights,
      masteredHighlights,
      reviewRate,
      totalVideos,
      todayReviewed,
      streakDays
    };
  } catch (error) {
    console.error('getLearningOverview error:', error);
    return { error: error.message };
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
