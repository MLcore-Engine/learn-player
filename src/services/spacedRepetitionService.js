/**
 * 间隔重复学习服务（Anki算法）
 * 实现SM-2算法的间隔重复，用于背单词
 */

class SpacedRepetitionService {
  /**
   * SM-2算法参数
   */
  static SM2_CONFIG = {
    INITIAL_EASE: 2.5,      // 初始易度因子
    MIN_EASE: 1.3,          // 最小易度因子
    EASE_CHANGE: 0.15,      // 易度因子变化量
    MIN_INTERVAL: 1,        // 最小间隔（天）
    MAX_INTERVAL: 365,      // 最大间隔（天）
    GRADE_AGAIN: 0,         // 重来
    GRADE_HARD: 1,          // 困难
    GRADE_GOOD: 2,          // 良好
    GRADE_EASY: 3           // 简单
  };

  /**
   * 计算下次复习时间（SM-2算法）
   * @param {Object} card - 单词卡片 { ease, interval, repetitions, lastReview }
   * @param {number} quality - 评分 (0-3)
   * @returns {Object} 更新后的卡片数据
   */
  calculateNextReview(card, quality) {
    const config = SpacedRepetitionService.SM2_CONFIG;
    let { ease = config.INITIAL_EASE, interval = 0, repetitions = 0 } = card;

    // 根据评分调整易度因子
    if (quality < config.GRADE_GOOD) {
      // 重来或困难：降低易度因子
      ease = Math.max(config.MIN_EASE, ease - (config.EASE_CHANGE * (config.GRADE_GOOD - quality)));
      repetitions = 0;
      interval = config.MIN_INTERVAL;
    } else {
      // 良好或简单：增加易度因子和间隔
      if (quality === config.GRADE_EASY) {
        ease += config.EASE_CHANGE;
      }
      
      repetitions += 1;
      
      // 计算新的间隔
      if (repetitions === 1) {
        interval = 1;
      } else if (repetitions === 2) {
        interval = 6;
      } else {
        interval = Math.round(interval * ease);
      }
      
      // 限制间隔范围
      interval = Math.min(Math.max(interval, config.MIN_INTERVAL), config.MAX_INTERVAL);
    }

    // 计算下次复习时间
    const now = new Date();
    const nextReview = new Date(now);
    nextReview.setDate(nextReview.getDate() + interval);

    return {
      ease,
      interval,
      repetitions,
      nextReview: nextReview.toISOString(),
      lastReview: now.toISOString()
    };
  }

  /**
   * 获取需要复习的单词
   * @param {Function} electronAPI - Electron API 函数
   * @param {number} limit - 返回数量限制
   * @returns {Promise<Array>} 需要复习的单词列表
   */
  async getWordsToReview(electronAPI, limit = 20) {
    if (!electronAPI || !electronAPI.invoke) {
      throw new Error('Electron API不可用');
    }

    try {
      const words = await electronAPI.invoke('getWordsToReview', { limit });
      return words;
    } catch (error) {
      console.error('获取复习单词失败:', error);
      throw error;
    }
  }

  /**
   * 提交单词复习结果
   * @param {Function} electronAPI - Electron API 函数
   * @param {string} wordId - 单词ID
   * @param {number} quality - 评分 (0-3)
   * @returns {Promise<Object>} 更新后的单词数据
   */
  async submitReview(electronAPI, wordId, quality) {
    if (!electronAPI || !electronAPI.invoke) {
      throw new Error('Electron API不可用');
    }

    try {
      // 获取当前单词卡片数据
      const card = await electronAPI.invoke('getVocabularyCard', { wordId });
      
      // 计算下次复习时间
      const updated = this.calculateNextReview(card, quality);
      
      // 保存更新
      const result = await electronAPI.invoke('updateVocabularyCard', {
        wordId,
        ...updated,
        quality
      });

      return result;
    } catch (error) {
      console.error('提交复习结果失败:', error);
      throw error;
    }
  }

  /**
   * 添加单词到学习列表
   * @param {Function} electronAPI - Electron API 函数
   * @param {Object} wordData - 单词数据 { word, phonetic, meaning, example }
   * @returns {Promise<Object>} 创建的单词卡片
   */
  async addWord(electronAPI, wordData) {
    if (!electronAPI || !electronAPI.invoke) {
      throw new Error('Electron API不可用');
    }

    try {
      const card = await electronAPI.invoke('addVocabularyWord', {
        ...wordData,
        ease: SpacedRepetitionService.SM2_CONFIG.INITIAL_EASE,
        interval: 0,
        repetitions: 0,
        nextReview: new Date().toISOString()
      });

      return card;
    } catch (error) {
      console.error('添加单词失败:', error);
      throw error;
    }
  }

  /**
   * 从AI查询记录中提取单词并添加到学习列表
   * @param {Function} electronAPI - Electron API 函数
   * @param {number} limit - 提取数量限制
   * @returns {Promise<number>} 成功添加的单词数量
   */
  async extractWordsFromQueries(electronAPI, limit = 50) {
    if (!electronAPI || !electronAPI.invoke) {
      throw new Error('Electron API不可用');
    }

    try {
      const result = await electronAPI.invoke('extractWordsFromQueries', { limit });
      return result.count || 0;
    } catch (error) {
      console.error('从查询记录提取单词失败:', error);
      throw error;
    }
  }

  /**
   * 获取学习统计
   * @param {Function} electronAPI - Electron API 函数
   * @returns {Promise<Object>} 学习统计
   */
  async getLearningStats(electronAPI) {
    if (!electronAPI || !electronAPI.invoke) {
      throw new Error('Electron API不可用');
    }

    try {
      const stats = await electronAPI.invoke('getVocabularyStats');
      return stats;
    } catch (error) {
      console.error('获取学习统计失败:', error);
      throw error;
    }
  }
}

export default new SpacedRepetitionService();
