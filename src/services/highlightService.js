/**
 * highlightService.js - 统一高亮服务
 * 封装所有 highlights 相关的 IPC 调用
 */

const ipcClient = window.electronAPI;

/**
 * 创建高亮
 * @param {Object} highlightData - 高亮数据
 * @returns {Promise<Object>} 创建结果
 */
export async function createHighlight(highlightData) {
  try {
    return await ipcClient.createHighlight(highlightData);
  } catch (error) {
    console.error('createHighlight error:', error);
    return { error: error.message };
  }
}

/**
 * 获取高亮列表
 * @param {Object} options - 查询选项
 * @param {string} [options.videoPath] - 视频路径
 * @param {string} [options.status] - 状态筛选
 * @param {number} [options.limit=50] - 返回数量限制
 * @param {number} [options.offset=0] - 偏移量
 * @returns {Promise<Array>} 高亮列表
 */
export async function getHighlights({ videoPath, status, limit = 50, offset = 0 } = {}) {
  try {
    return await ipcClient.getHighlights({ videoPath, status, limit, offset });
  } catch (error) {
    console.error('getHighlights error:', error);
    return { error: error.message };
  }
}

/**
 * 获取单个高亮
 * @param {string} id - 高亮ID
 * @returns {Promise<Object>} 高亮数据
 */
export async function getHighlight(id) {
  try {
    return await ipcClient.getHighlight({ id });
  } catch (error) {
    console.error('getHighlight error:', error);
    return { error: error.message };
  }
}

/**
 * 更新高亮
 * @param {Object} params - 更新参数，包含 id 和其他字段
 * @returns {Promise<Object>} 更新结果
 */
export async function updateHighlight({ id, ...fields }) {
  try {
    return await ipcClient.updateHighlight({ id, ...fields });
  } catch (error) {
    console.error('updateHighlight error:', error);
    return { error: error.message };
  }
}

/**
 * 删除高亮
 * @param {string} id - 高亮ID
 * @returns {Promise<Object>} 删除结果
 */
export async function deleteHighlight(id) {
  try {
    return await ipcClient.deleteHighlight({ id });
  } catch (error) {
    console.error('deleteHighlight error:', error);
    return { error: error.message };
  }
}

/**
 * 获取待复习高亮
 * @param {Object} options - 查询选项
 * @param {number} [options.limit=20] - 返回数量限制
 * @param {string} [options.status] - 状态筛选
 * @returns {Promise<Array>} 待复习高亮列表
 */
export async function getDueHighlights({ limit = 20, status } = {}) {
  try {
    return await ipcClient.getDueHighlights({ limit, status });
  } catch (error) {
    console.error('getDueHighlights error:', error);
    return { error: error.message };
  }
}

/**
 * 提交复习结果
 * @param {string} id - 高亮ID
 * @param {number} quality - 记忆质量评级 (0-3)
 * @returns {Promise<Object>} 提交结果
 */
export async function submitReview(id, quality) {
  try {
    return await ipcClient.submitReview({ id, quality });
  } catch (error) {
    console.error('submitReview error:', error);
    return { error: error.message };
  }
}
