import axios from 'axios';
import { ipcClient } from '../services/ipcClient';
import resolveAiConfig from '../services/aiConfigService';

// 创建 axios 实例
const axiosInstance = axios.create({
  timeout: 30000, // 30秒超时
  headers: {
    'Content-Type': 'application/json'
  }
});

// 默认OCR服务配置
const defaultOcrConfig = {
  apiKey: '',
  apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  ocrEndpoint: '/api/vision-ocr', // OCR专用端点（保留兼容性）
  model: 'GLM-4V-Flash'
};

// OCR识别接口配置
const OCR_SYSTEM_PROMPT = `You are an expert OCR (Optical Character Recognition) system specialized in recognizing English subtitles from video frames.

Your task is to:
1. Analyze the provided image data
2. Extract English text from subtitle regions (typically bottom 10-15% of the image)
3. Return only the clean, recognized text without any additional commentary
4. Handle common subtitle artifacts like timestamps, formatting codes, and noise

Important guidelines:
- Focus on the bottom region of the image where subtitles usually appear
- Remove any non-text elements like timestamps (00:00:00 format), speaker labels, or formatting codes
- Clean up spacing and punctuation
- If no text is found, return empty string
- Only return the recognized English text, nothing else`;

/**
 * OCR API服务类 - 使用智谱AI GLM-4V-Flash进行OCR识别和文本解释
 */
class OcrApiService {
  constructor(config = {}) {
    this.config = {
      ...defaultOcrConfig,
      ...config,
      apiUrl: config.modelUrl || defaultOcrConfig.apiUrl // 支持通过modelUrl设置apiUrl
    };
  }

  /**
   * 设置API密钥
   * @param {string} apiKey - API密钥
   */
  setApiKey(apiKey) {
    this.config.apiKey = apiKey;
  }

  /**
   * 设置模型URL
   * @param {string} modelUrl - 模型URL
   */
  setModelUrl(modelUrl) {
    this.config.apiUrl = modelUrl;
  }

  /**
   * 设置模型
   * @param {string} model - 模型名称
   */
  setModel(model) {
    this.config.model = model;
  }

  async getApiConfig() {
    const { apiKey, apiUrl, model } = await resolveAiConfig({
      apiKey: this.config.apiKey,
      apiUrl: this.config.apiUrl,
      model: this.config.model
    });

    return { apiKey, apiUrl, model };
  }

  /**
   * 接口1: OCR识别字幕句子
   * 从视频帧图像中识别英文字幕文本
   * @param {string} imageDataUrl - 图像数据 (data:image/png;base64,... 格式)
   * @param {object} options - 配置选项
   * @returns {Promise<string>} 识别出的字幕文本
   */
  async performOcrRecognition(imageDataUrl, options = {}) {
    try {
      if (!imageDataUrl) {
        throw new Error('图像数据不能为空');
      }

      const { apiKey, apiUrl, model } = await this.getApiConfig();

      // 构造智谱AI视觉模型请求体
      const requestData = {
        model: options.model || model, // 使用智谱AI的GLM-4V-Flash视觉模型
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: imageDataUrl // 直接使用base64数据URL
                }
              },
              {
                type: "text",
                text: `Please extract and return ONLY the English subtitle text from the bottom area of this image. Focus on the subtitle region (typically bottom 15-18% of the image). Remove any timestamps, speaker labels, or formatting codes. Return only the clean English text content, nothing else. If no subtitle text is visible, return empty string.`
              }
            ]
          }
        ],
        thinking: {
          type: "enabled" // 启用思考过程
        },
        temperature: 0.1, // 降低随机性，提高准确性
        max_tokens: 500 // 限制输出长度
      };

      // 发送请求
      let data;
      // 如果在 Electron 环境下，可通过主进程发起请求，避免 CORS
      if (ipcClient.isAvailable()) {
        const result = await ipcClient.performAIRequest(requestData, apiUrl, apiKey);
        if (!result.success) {
          throw new Error(result.error || '主进程 OCR 请求失败');
        }
        data = result.data;
      } else {
        const response = await axiosInstance.post(
          apiUrl,
          requestData,
          { headers: { 'Authorization': `Bearer ${apiKey}` } }
        );
        data = response.data;
      }

      // 检查响应状态
      if (!data) {
        throw new Error('服务器返回空响应');
      }

      // 提取识别结果，兼容智谱AI GLM-4V-Flash的返回格式
      let recognizedText = '';
      const candidates = [
        data?.choices?.[0]?.message?.content, // GLM-4V-Flash标准格式
        data?.text,
        data?.data?.text,
        data?.result?.text
      ];
      recognizedText = candidates.find(t => typeof t === 'string' && t.trim().length > 0) || '';

      // 后处理清理
      recognizedText = this.postprocessOcrText(recognizedText);

      return recognizedText;
    } catch (error) {
      console.error('OCR识别请求失败:', error);
      if (error.response) {
        // 服务器返回错误状态码
        throw new Error(`服务器错误: ${error.response.status} - ${error.response.data?.message || '未知错误'}`);
      } else if (error.request) {
        // 请求发送失败
        throw new Error('无法连接到服务器，请检查网络连接');
      } else {
        // 其他错误
        throw new Error(`OCR识别失败: ${error.message}`);
      }
    }
  }

  /**
   * 接口2: 解释识别出的字幕句子
   * 对OCR识别出的文本进行英语解释
   * @param {string} recognizedText - OCR识别出的文本
   * @param {object} options - 配置选项
   * @returns {Promise<string>} 解释结果
   */
  async explainRecognizedText(recognizedText, options = {}) {
    try {
      if (!recognizedText || recognizedText.trim().length === 0) {
        throw new Error('识别文本不能为空');
      }

      // 导入aiService进行解释 (复用现有逻辑)
      const aiService = (await import('../services/aiService')).default;

      // 使用现有的解释接口
      const explanation = await aiService.getExplanation(recognizedText, {
        language: options.language || 'zh', // 默认中文解释
        model: options.model || this.config.model,
        ...options
      });

      return explanation;
    } catch (error) {
      console.error('文本解释请求失败:', error);
      throw new Error(`文本解释失败: ${error.message}`);
    }
  }

  /**
   * OCR文本后处理
   * @param {string} text - 原始识别文本
   * @returns {string} 处理后的文本
   */
  postprocessOcrText(text) {
    let cleanedText = (text || '')
      .replace(/\s+/g, ' ')  // 合并连续空格
      .trim();

    // 移除常见的字幕噪声
    cleanedText = cleanedText
      .replace(/^\d+\s*/, '')  // 移除开头的数字
      .replace(/^\d{1,2}:\d{2}(:\d{2})?\s*/, '')  // 移除时间戳
      .replace(/^(PR|CC|SD|HD|SUB|CAP)\s*/i, '')  // 移除字幕格式标签
      .replace(/^[A-Z]{2,3}\s+/, '')  // 移除说话人标签
      .replace(/^ie\s*/i, '')  // 移除IE标签
      .replace(/^[^a-zA-Z]+/, '')  // 移除非字母开头的内容
      .trim();

    return cleanedText;
  }

  /**
   * 综合OCR和解释流程
   * 先识别字幕，然后解释识别结果
   * @param {string} imageDataUrl - 图像数据
   * @param {object} options - 配置选项
   * @returns {Promise<{recognizedText: string, explanation: string}>}
   */
  async recognizeAndExplain(imageDataUrl, options = {}) {
    try {
      // 步骤1: OCR识别
      const recognizedText = await this.performOcrRecognition(imageDataUrl, options);

      if (!recognizedText) {
        return {
          recognizedText: '',
          explanation: '未识别到字幕文本'
        };
      }

      // 步骤2: 解释识别结果
      const explanation = await this.explainRecognizedText(recognizedText, options);

      return {
        recognizedText,
        explanation
      };
    } catch (error) {
      console.error('OCR识别和解释流程失败:', error);
      throw error;
    }
  }
}

// 创建并导出单例实例
const ocrApiService = new OcrApiService();
export default ocrApiService;

// 导出类和默认配置供高级用户使用
export { OcrApiService, defaultOcrConfig };

// 开发环境下的配置检查
if (process.env.NODE_ENV === 'development') {
  console.log('OCR API配置:', {
    apiUrl: defaultOcrConfig.apiUrl,
    model: defaultOcrConfig.model,
    hasApiKey: !!defaultOcrConfig.apiKey
  });
}

/*
使用示例：

// 基本OCR识别
const imageDataUrl = 'data:image/png;base64,...';
const recognizedText = await ocrApiService.performOcrRecognition(imageDataUrl);

// 识别并解释
const result = await ocrApiService.recognizeAndExplain(imageDataUrl, {
  language: 'zh'  // 中文解释
});
console.log('识别结果:', result.recognizedText);
console.log('解释内容:', result.explanation);

// 自定义配置
const customOcrService = new OcrApiService({
  apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  apiKey: 'your-api-key',
  model: 'GLM-4V-Flash'
});
*/
