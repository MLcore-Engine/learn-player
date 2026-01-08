import axios from 'axios';

class AIService {
  constructor() {
    this.baseURL = 'http://58.211.207.202:20000/api';
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // 添加响应拦截器处理错误
    this.client.interceptors.response.use(
      response => response,
      error => {
        let errorMessage;
        
        if (error.response) {
          // 服务器返回错误状态码
          switch (error.response.status) {
            case 401:
              errorMessage = 'API认证失败，请检查API Key设置';
              break;
            case 403:
              errorMessage = '没有权限访问此服务';
              break;
            case 429:
              errorMessage = '请求过于频繁，请稍后再试';
              break;
            case 500:
              errorMessage = '服务器内部错误';
              break;
            default:
              errorMessage = `服务器错误: ${error.response.status} - ${error.response.data?.message || '未知错误'}`;
          }
        } else if (error.request) {
          // 请求发出但没有收到响应
          errorMessage = '无法连接到服务器，请检查网络连接';
        } else {
          // 请求配置出错
          errorMessage = `请求错误: ${error.message}`;
        }

        // 创建一个新的错误对象，包含更详细的信息
        const enhancedError = new Error(errorMessage);
        enhancedError.originalError = error;
        enhancedError.isAxiosError = true;
        throw enhancedError;
      }
    );
  }

  // 获取API Key
  async getApiKey() {
    try {
      const response = await window.electronAPI.invoke('getApiKey');
      if (!response || !response.apiKey) {
        throw new Error('未设置API Key');
      }
      return response.apiKey;
    } catch (error) {
      console.error('获取API Key失败:', error);
      throw new Error('获取API Key失败，请检查设置');
    }
  }

  // 获取AI解释
  async getExplanation(text) {
    if (!text || typeof text !== 'string' || text.trim() === '') {
      throw new Error('无效的文本输入');
    }

    try {
      const apiKey = await this.getApiKey();
      const response = await this.client.post('/chat', {
        text: text.trim(),
        apiKey
      });

      if (!response.data || !response.data.explanation) {
        throw new Error('服务器返回的数据格式不正确');
      }

      return response.data.explanation;
    } catch (error) {
      console.error('AI服务请求失败:', error);
      // 如果是我们自定义的错误，直接抛出
      if (error.message && !error.isAxiosError) {
        throw error;
      }
      // 否则抛出原始错误
      throw error.originalError || error;
    }
  }
}

export default new AIService(); 