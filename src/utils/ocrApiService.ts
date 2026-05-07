import axios, { AxiosError } from 'axios';
import { ipcClient } from '../services/ipcClient';
import resolveAiConfig from '../services/aiConfigService';
import type { Language } from '../types/highlight';

const axiosInstance = axios.create({
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

interface OcrConfig {
  apiKey: string;
  apiUrl: string;
  ocrEndpoint: string;
  model: string;
}

const defaultOcrConfig: OcrConfig = {
  apiKey: '',
  apiUrl: 'https://api.stepfun.com/v1/chat/completions',
  ocrEndpoint: '/api/vision-ocr',
  model: 'step-1v-8k'
};

export interface OcrApiOptions {
  model?: string;
  language?: Language;
  [key: string]: unknown;
}

interface VisionResponse {
  text?: string;
  data?: { text?: string };
  result?: { text?: string };
  choices?: Array<{ message?: { content?: string } }>;
}

export class OcrApiService {
  private config: OcrConfig;

  constructor(config: Partial<OcrConfig> & { modelUrl?: string } = {}) {
    this.config = {
      ...defaultOcrConfig,
      ...config,
      apiUrl: config.modelUrl || config.apiUrl || defaultOcrConfig.apiUrl
    };
  }

  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
  }

  setModelUrl(modelUrl: string): void {
    this.config.apiUrl = modelUrl;
  }

  setModel(model: string): void {
    this.config.model = model;
  }

  async getApiConfig(): Promise<{ apiKey: string; apiUrl: string; model: string }> {
    const { apiKey, apiUrl, model } = await resolveAiConfig({
      apiKey: this.config.apiKey,
      apiUrl: this.config.apiUrl,
      model: this.config.model
    });

    return { apiKey, apiUrl, model };
  }

  async performOcrRecognition(imageDataUrl: string, options: OcrApiOptions = {}): Promise<string> {
    try {
      if (!imageDataUrl) {
        throw new Error('图像数据不能为空');
      }

      const { apiKey, apiUrl, model } = await this.getApiConfig();

      const requestData = {
        model: options.model || model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imageDataUrl } },
              {
                type: 'text',
                text: 'Please extract and return ONLY the English subtitle text from the bottom area of this image. Focus on the subtitle region (typically bottom 15-18% of the image). Remove any timestamps, speaker labels, or formatting codes. Return only the clean English text content, nothing else. If no subtitle text is visible, return empty string.'
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      };

      let data: VisionResponse | undefined;
      if (ipcClient.isAvailable()) {
        const result = await ipcClient.performAIRequest(requestData, apiUrl, apiKey);
        if (!result.success) {
          throw new Error(result.error || '主进程 OCR 请求失败');
        }
        data = result.data as VisionResponse;
      } else {
        const response = await axiosInstance.post<VisionResponse>(
          apiUrl,
          requestData,
          { headers: { Authorization: `Bearer ${apiKey}` } }
        );
        data = response.data;
      }

      if (!data) {
        throw new Error('服务器返回空响应');
      }

      const candidates: Array<string | undefined> = [
        data?.choices?.[0]?.message?.content,
        data?.text,
        data?.data?.text,
        data?.result?.text
      ];
      const recognizedText = candidates.find((t): t is string => typeof t === 'string' && t.trim().length > 0) || '';

      return this.postprocessOcrText(recognizedText);
    } catch (error) {
      console.error('OCR识别请求失败:', error);
      const axiosError = error as AxiosError<{ message?: string }>;
      if (axiosError.response) {
        throw new Error(
          `服务器错误: ${axiosError.response.status} - ${axiosError.response.data?.message || '未知错误'}`
        );
      } else if (axiosError.request) {
        throw new Error('无法连接到服务器，请检查网络连接');
      } else {
        throw new Error(`OCR识别失败: ${(error as Error).message}`);
      }
    }
  }

  async explainRecognizedText(recognizedText: string, options: OcrApiOptions = {}): Promise<string> {
    try {
      if (!recognizedText || recognizedText.trim().length === 0) {
        throw new Error('识别文本不能为空');
      }

      const aiService = (await import('../services/aiService')).default;

      const explanation = await aiService.getExplanation(recognizedText, {
        language: options.language || 'zh',
        model: options.model || this.config.model,
        ...options
      });

      return explanation;
    } catch (error) {
      console.error('文本解释请求失败:', error);
      throw new Error(`文本解释失败: ${(error as Error).message}`);
    }
  }

  postprocessOcrText(text: string): string {
    let cleanedText = (text || '').replace(/\s+/g, ' ').trim();

    cleanedText = cleanedText
      .replace(/^\d+\s*/, '')
      .replace(/^\d{1,2}:\d{2}(:\d{2})?\s*/, '')
      .replace(/^(PR|CC|SD|HD|SUB|CAP)\s*/i, '')
      .replace(/^[A-Z]{2,3}\s+/, '')
      .replace(/^ie\s*/i, '')
      .replace(/^[^a-zA-Z]+/, '')
      .trim();

    return cleanedText;
  }

  async recognizeAndExplain(
    imageDataUrl: string,
    options: OcrApiOptions = {}
  ): Promise<{ recognizedText: string; explanation: string }> {
    try {
      const recognizedText = await this.performOcrRecognition(imageDataUrl, options);

      if (!recognizedText) {
        return { recognizedText: '', explanation: '未识别到字幕文本' };
      }

      const explanation = await this.explainRecognizedText(recognizedText, options);
      return { recognizedText, explanation };
    } catch (error) {
      console.error('OCR识别和解释流程失败:', error);
      throw error;
    }
  }
}

const ocrApiService = new OcrApiService();
export default ocrApiService;

export { defaultOcrConfig };

if (process.env.NODE_ENV === 'development') {
  console.log('OCR API配置:', {
    apiUrl: defaultOcrConfig.apiUrl,
    model: defaultOcrConfig.model,
    hasApiKey: !!defaultOcrConfig.apiKey
  });
}
