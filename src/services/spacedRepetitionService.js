import { ipcClient } from './ipcClient';
import { getDueHighlights, submitReview as submitHighlightReview } from './highlightService';

/**
 * 间隔重复服务
 * 实现类似Anki的间隔重复算法，管理单词记忆
 */

class SpacedRepetitionService {
  constructor() {
    // 用户记忆质量评级
    this.qualityRatings = {
      AGAIN: 0, // 完全不记得
      HARD: 1,  // 记得模糊
      GOOD: 2,  // 记得
      EASY: 3   // 轻松记得
    };

    // 间隔重复算法参数
    this.eFactorMin = 1.3; // 最小难度系数
  }

  /**
   * 获取需要复习的单词
   * @param {number} limit - 复习单词数量限制
   * @returns {Promise<Array>} 待复习单词列表
   */
  async getWordsToReview(limit = 20) {
    if (!ipcClient.isAvailable()) {
      throw new Error('Electron API不可用');
    }

    try {
      const words = await ipcClient.getWordsToReview({ limit });
      return words;
    } catch (error) {
      console.error('获取复习单词失败:', error);
      throw error;
    }
  }

  /**
   * 获取今日待复习高亮
   * @param {number} limit - 复习数量限制
   * @returns {Promise<Array>} 待复习高亮列表
   */
  async getTodayReview(limit = 20) {
    try {
      const highlights = await getDueHighlights({ limit });
      if (highlights.error) {
        throw new Error(highlights.error);
      }
      return highlights;
    } catch (error) {
      console.error('获取今日复习失败:', error);
      return { error: error.message };
    }
  }

  /**
   * 提交单词复习结果
   * @param {string} wordId - 单词ID
   * @param {number} quality - 记忆质量评级
   * @returns {Promise<Object>} 更新结果
   */
  async submitReview(wordId, quality) {
    if (!ipcClient.isAvailable()) {
      throw new Error('Electron API不可用');
    }

    try {
      const card = await ipcClient.getVocabularyCard({ wordId });
      if (!card) {
        throw new Error('单词卡片不存在');
      }

      const updatedCard = this.calculateNextReview(card, quality);
      const result = await ipcClient.updateVocabularyCard({
        wordId,
        ...updatedCard
      });

      return result;
    } catch (error) {
      console.error('提交复习结果失败:', error);
      throw error;
    }
  }

  /**
   * 更新复习结果（使用 highlightService）
   * @param {string} id - 高亮ID
   * @param {number} quality - 记忆质量评级
   * @returns {Promise<Object>} 更新结果
   */
  async updateReview(id, quality) {
    try {
      const result = await submitHighlightReview(id, quality);
      if (result.error) {
        throw new Error(result.error);
      }
      return result;
    } catch (error) {
      console.error('更新复习结果失败:', error);
      return { error: error.message };
    }
  }

  /**
   * 添加新单词
   * @param {Object} wordData - 单词数据
   * @returns {Promise<Object>} 添加结果
   */
  async addWord(wordData) {
    if (!ipcClient.isAvailable()) {
      throw new Error('Electron API不可用');
    }

    try {
      const card = {
        ...wordData,
        repetitions: 0,
        interval: 1,
        eFactor: 2.5,
        nextReviewDate: new Date().toISOString()
      };

      const result = await ipcClient.addVocabularyWord({
        ...card
      });

      return result;
    } catch (error) {
      console.error('添加新单词失败:', error);
      throw error;
    }
  }

  /**
   * 从AI查询记录中提取单词
   * @param {number} limit - 最大提取数量
   * @returns {Promise<Object>} 提取结果
   */
  async extractWordsFromQueries(limit = 50) {
    if (!ipcClient.isAvailable()) {
      throw new Error('Electron API不可用');
    }

    try {
      const result = await ipcClient.extractWordsFromQueries({ limit });
      return result;
    } catch (error) {
      console.error('提取单词失败:', error);
      throw error;
    }
  }

  /**
   * 获取学习统计数据
   * @returns {Promise<Object>} 统计数据
   */
  async getLearningStats() {
    if (!ipcClient.isAvailable()) {
      throw new Error('Electron API不可用');
    }

    try {
      const stats = await ipcClient.getVocabularyStats();
      return stats;
    } catch (error) {
      console.error('获取学习统计失败:', error);
      throw error;
    }
  }

  /**
   * 计算下一次复习时间
   * @param {Object} card - 单词卡片
   * @param {number} quality - 记忆质量评级
   * @returns {Object} 更新后的卡片数据
   */
  calculateNextReview(card, quality) {
    // 简化的间隔重复算法
    let { repetitions, interval, eFactor } = card;

    if (quality < 2) {
      // 如果记忆质量差，重置复习
      repetitions = 0;
      interval = 1;
    } else {
      // 增加复习次数
      repetitions += 1;

      // 计算新间隔
      if (repetitions === 1) {
        interval = 1;
      } else if (repetitions === 2) {
        interval = 6;
      } else {
        interval = Math.round(interval * eFactor);
      }

      // 更新难度系数
      eFactor = eFactor + (0.1 - (3 - quality) * (0.08 + (3 - quality) * 0.02));
      if (eFactor < this.eFactorMin) eFactor = this.eFactorMin;
    }

    // 计算下次复习日期
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + interval);

    return {
      repetitions,
      interval,
      eFactor,
      nextReviewDate: nextReviewDate.toISOString()
    };
  }
}

const spacedRepetitionService = new SpacedRepetitionService();
export default SpacedRepetitionService;
