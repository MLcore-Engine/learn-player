import axios from 'axios';
import { ipcClient } from './ipcClient';
import resolveAiConfig from './aiConfigService';

// 创建 axios 实例
const axiosInstance = axios.create({
  timeout: 30000, // 30秒超时
  headers: {
    'Content-Type': 'application/json'
  }
});

// 默认AI服务配置 - 使用智谱AI同步接口
const defaultConfig = {
  apiKey: '',
  apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  model: 'glm-4.7-flash' // 智谱文本模型，与官方文档一致 https://docs.bigmodel.cn/cn/guide/models/free/glm-4.7-flash
};

// 主 prompt 内容
const SYSTEM_PROMPT_ZH = [
  "You are an expert in American English. Always use **KK phonetic transcription** for pronunciations, and ensure responses align with standard American English. Do not use IPA or other phonetic systems.",
  "",
  "**When given a word:**",
  "1. Provide the word, its KK phonetic transcription, part of speech, and meaning(s) in this format:",
  "   - **{Word}** `/KK transcription/` **{Part of Speech}** \"{Meaning(s)}\"",
  "   - Example: **nucleus** `/ˈnukliəs/` **n.** \"原子核\" \"核心\"",
  "",
  "2. Give a simple English sentence using the word, followed by its Chinese translation.",
  "   - Example: The nucleus is at the center of the atom. (原子核在原子的中心。)",
  "",
  "3. List common synonyms (especially for adjectives) to expand everyday vocabulary.",
  "   - Example: Common synonyms include \"core\" and \"kernel.\"",
  "",
  "4. Provide cultural, linguistic, or academic background to explain the word's usage or significance in American English.",
  "   - Example: In scientific fields like physics and chemistry, \"nucleus\" is a key term. In daily English, it can mean the core of a group, e.g., \"the nucleus of a team.\"",
  "",
  "**When given a sentence:**",
  "Focus on grammar analysis and key vocabulary only. Do NOT explain every single word. Follow this format:",
  "1. **中文翻译**：提供句子的中文翻译",
  "2. **语法解析**：深入分析句子的语法结构，包括：",
  "   - 句子类型（简单句/复合句/复杂句等）",
  "   - 时态和语态",
  "   - 主要语法点（如从句、非谓语动词、虚拟语气等）",
  "   - 特殊语法结构（如倒装、强调、省略等）",
  "3. **重点词汇**：只解释句子中的关键/难点词汇（如不常见的词、易混淆的词、或重要的语法词汇），格式：",
  "   - **{Word}** `/KK transcription/` **{Part of Speech}** \"{Meaning}\"",
  "4. 如有文化背景或习语，请简要说明",
  "",
  "**Important:**",
  "- Use KK phonetic transcription exclusively for pronunciations.",
  "- Enclose transcriptions in backticks or code blocks for easy copying.",
  "",
  "【Few-shot Examples】"
];

// 单词 few-shot 示例内容
const FEW_SHOT_EXAMPLES_WORD = [
  '1. **glimpse** `/ɡlɪmps/` **n.** 一瞥；一看；短暂的感受（或体验、领会）  **v.** 瞥见；看一眼；开始领悟到；开始认识到',
  '2. **example**：',
  '    - **n**：I caught a glimpse of her in the crowd.（我在人群中瞥见了她一眼。）',
  '    - **v**：She glimpsed a figure in the dark.（她在黑暗中瞥见一个身影。）',
  '3. **同义词**：',
  '    - **名词**：glance（匆匆一看，与"glimpse"都表示短暂地看，但"glance"可能更主动，"glimpse"更倾向于不经意看到），peek（偷偷地看一眼）',
  '    - **动词**："catch sight of"（看见，较为口语化，和"glimpse"作为"瞥见"意思相近）。',
  '4. **背景知识**：在美式英语中，"glimpse"常用来描述瞬间、短暂的视觉体验。这种瞬间的视觉捕捉在日常生活和文学作品中都很常见。在日常对话里，人们会用它来描述偶然看到的场景或人。在文学创作中，作者常用"glimpse"营造一种意外、瞬间的感觉，给读者留下深刻印象，以引发读者的好奇心或为故事发展埋下伏笔。',
  '',

  '1. **detailed** `/dɪˈteld/` **adj.（形容词）** "详细的；细致的；精细的"',
  '2. **example**：He gave a detailed description of the accident.（他对事故进行了详细的描述。）',
  '3. **常见同义词**：specific（具体的，强调明确、特定，与"detailed"侧重细节的意思相关），thorough（全面的、详尽的，同样表达对事物描述或处理的细致程度），elaborate（精心制作的、详尽阐述的，语义与"detailed"相近）。',
  '4. **背景知识**：在美式英语中，"detailed"广泛应用于各种场景。在商务场合，撰写报告时需要提供"detailed information"（详细信息），以确保决策基于充分的数据和事实；在学术写作中，研究成果的阐述要求"detailed analysis"（详细分析），展示研究的严谨性；日常交流中，当人们想要准确传达复杂信息时，也会追求描述得"detailed"。它体现了对信息完整性和精确性的重视。',
];

// 句子 few-shot 示例内容
const FEW_SHOT_EXAMPLES_SENTENCE = [
  '**句子**：I should have studied harder for the exam.',
  '',
  '1. **中文翻译**：我本应该为考试更努力学习的。',
  '',
  '2. **语法解析**：',
  '   - **句子类型**：简单句（Simple Sentence）',
  '   - **时态**：过去完成时（Past Perfect Tense）的虚拟语气用法',
  '   - **语法点**：',
  '     * "should have + 过去分词" 表示过去应该做但实际未做的事情，含有后悔、遗憾的语气',
  '     * 这是情态动词的完成式用法，表达对过去行为的评价或建议',
  '     * "should have studied" 表示"本应该学习"（但实际上没有）',
  '   - **句子结构**：主语(I) + 情态动词(should) + 完成式(have studied) + 状语(harder) + 介词短语(for the exam)',
  '',
  '3. **重点词汇**：',
  '   - **should** `/ʃʊd/` **aux.** "应该"（表示义务、建议或推测）',
  '   - **exam** `/ɪgˈzæm/` **n.** "考试"（examination的缩写）',
  '',
  '---',
  '',
  '**句子**：Had I known about the meeting, I would have attended it.',
  '',
  '1. **中文翻译**：如果我早知道这个会议，我就会参加了。',
  '',
  '2. **语法解析**：',
  '   - **句子类型**：复杂句（Complex Sentence），包含条件状语从句',
  '   - **时态**：过去完成时（Past Perfect）的虚拟语气',
  '   - **语法点**：',
  '     * 这是 if 虚拟条件句的倒装形式，"Had I known" = "If I had known"',
  '     * 省略 if 后，将助动词 had 提前，形成倒装结构',
  '     * 主句用 "would have + 过去分词" 表示与过去事实相反的假设结果',
  '     * 整个句子表达对过去没有发生的事情的假设',
  '   - **句子结构**：倒装的条件从句(Had I known...) + 主句(I would have attended...)',
  '',
  '3. **重点词汇**：',
  '   - **attend** `/əˈtɛnd/` **v.** "参加；出席"',
  '',
  '---',
  '',
  '**句子**：The book that I borrowed from the library yesterday is very interesting.',
  '',
  '1. **中文翻译**：我昨天从图书馆借的那本书非常有趣。',
  '',
  '2. **语法解析**：',
  '   - **句子类型**：复杂句（Complex Sentence），包含定语从句',
  '   - **时态**：一般现在时（Present Simple）',
  '   - **语法点**：',
  '     * "that I borrowed from the library yesterday" 是定语从句，修饰主语 "The book"',
  '     * 关系代词 "that" 在从句中作宾语，可以省略',
  '     * 从句中的时间状语 "yesterday" 放在句末，符合英语表达习惯',
  '     * 主句是 "The book is very interesting"，从句是插入的修饰成分',
  '',
  '3. **重点词汇**：',
  '   - **borrow** `/ˈbɑro/` **v.** "借入"（borrow...from 表示"从...借来"）',
];

// 合并主 prompt 和 few-shot 示例，并明确示例意图
const FINAL_SYSTEM_PROMPT_ZH = [
  // 基础系统提示
  ...SYSTEM_PROMPT_ZH,
  '',
  '以下是 few-shot 示例，演示期望的回答格式：',
  // few-shot 示例内容
  ...FEW_SHOT_EXAMPLES_WORD,
  '',
  '请严格按照以上示例格式和要求回答用户的提问。'
].join('\n');

// 句子专用的系统提示词
const FINAL_SYSTEM_PROMPT_ZH_SENTENCE = [
  // 基础系统提示
  ...SYSTEM_PROMPT_ZH,
  '',
  '以下是 few-shot 示例，演示句子解析的期望格式：',
  // 句子 few-shot 示例内容
  ...FEW_SHOT_EXAMPLES_SENTENCE,
  '',
  '请严格按照以上示例格式和要求回答用户的提问。'
].join('\n');

/**
 * 判断输入是单词还是句子
 * @param {string} text - 输入文本
 * @returns {boolean} true表示是句子，false表示是单词
 */
function isSentence(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  // 如果包含空格、标点符号（句号、问号、感叹号等），且长度大于一定值，认为是句子
  const hasSpaces = trimmed.includes(' ');
  const hasPunctuation = /[.!?]/.test(trimmed);
  const wordCount = trimmed.split(/\s+/).filter(w => w.length > 0).length;
  // 如果有空格或标点，且单词数>=2，认为是句子
  return (hasSpaces || hasPunctuation) && wordCount >= 2;
}

const SYSTEM_PROMPT_EN = `You are a professional American English expert. I will provide you with a single English word. Please respond entirely in American English and follow these updated guidelines:

1. KK Phonetic Transcription
Present the KK (Kenyon and Knott) phonetic transcription of the word. For example: \`[ˈbɛd]\`.
2. Part of Speech
Specify the word's part of speech (e.g., noun, verb, adjective, etc.). For example: Noun.
3. Simple Example Sentence
Provide a short, natural-sounding sentence in everyday American English that illustrates how the word is typically used. Keep the example very simple and practical for daily conversations. For example: "I love learning a new language every year."
4. Easy-to-Understand Explanation
Offer a clear, concise definition of the word in American English. Keep the explanation simple and accessible to non-native speakers, avoiding technical jargon or complex phrases.
5. Frequency in Everyday Speech
Indicate how often the word is used in daily American English conversations. Use a scale of 1 to 5, where:
1 = Rarely used in casual conversation.
5 = Very common in everyday speech.

Important:
When providing the phonetic transcription, please use KK phonetics (e.g., \`/i, ɪ, e, ɛ, æ, ʌ, ə, u, ʊ, o, ɔ, ɑ, aɪ, aʊ, ɔɪ, ju, ɚ, ɝ, p, b, t, d, k, g, f, v, θ, ð, s, z, ʃ, ʒ, tʃ, dʒ, m, n, ŋ, l, r, j, w, h/\`). Wrap it in backticks or a code block so that I can easily copy and view it.

Do not use Chinese.
Use only American English.
Make sure your explanation focuses on the word's usage and context in everyday, native-level American English.`;

/**
 * AI服务类 - 负责与大语言模型API通信
 */
class AIService {
  constructor(config = {}) {
    this.config = {
      ...defaultConfig,
      ...config,
      apiUrl: config.modelUrl || defaultConfig.apiUrl // 支持通过modelUrl设置apiUrl
    };
    this.context = []; // 存储对话上下文
  }

  /**
   * 设置模型
   * @param {string} model - 模型名称
   */
  setModel(model) {
    this.config.model = model;
  }

  /**
   * 清空对话上下文
   */
  clearContext() {
    this.context = [];
  }

  /**
   * 添加上下文消息
   * @param {string} role - 角色 (system/user/assistant)
   * @param {string} content - 消息内容
   */
  addContextMessage(role, content) {
    this.context.push({ role, content });

    // 保持上下文在合理大小
    if (this.context.length > 10) {
      // 保留系统消息和最近的消息
      const systemMessages = this.context.filter(msg => msg.role === 'system');
      const recentMessages = this.context.slice(-8).filter(msg => msg.role !== 'system');
      this.context = [...systemMessages, ...recentMessages];
    }
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
   * 查询解释
   * @param {string} text - 需要解释的文本
   * @param {object} options - 配置选项
   * @returns {Promise<string>} 解释结果
   */
  async getExplanation(text, options = {}) {
    try {
      const raw = typeof text === 'string' ? text : '';
      const normalized = raw.trim();
      // 查询本地缓存
      if (ipcClient.isAvailable() && normalized) {
        try {
          const cache = await ipcClient.getCachedAiQuery({ query: normalized });
          if (cache && cache.hit && typeof cache.explanation === 'string') {
            return cache.explanation;
          }
        } catch (_) {}
      }

      const { apiKey, apiUrl, model } = await this.getApiConfig();

      // 清空上下文与添加系统提示
      this.clearContext();
      let systemPrompt;
      if (options.language === 'en') {
        systemPrompt = SYSTEM_PROMPT_EN;
      } else {
        // 根据输入类型选择不同的提示词
        const isSentenceInput = isSentence(normalized);
        systemPrompt = isSentenceInput ? FINAL_SYSTEM_PROMPT_ZH_SENTENCE : FINAL_SYSTEM_PROMPT_ZH;
      }
      this.addContextMessage('system', systemPrompt);
      this.addContextMessage('user', text);

      // 构造智谱AI同步接口请求体
      const requestData = {
        model: options.model || model,
        messages: this.context,
        stream: options.stream !== undefined ? options.stream : false,
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 2000
      };

      // 发送请求
      let data;
      // 如果在 Electron 环境下，可通过主进程发起请求，避免 CORS
      if (ipcClient.isAvailable()) {
        const result = await ipcClient.performAIRequest(requestData, apiUrl, apiKey);
        if (!result.success) {
          throw new Error(result.error || '主进程 AI 请求失败');
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

      // 提取回复内容，兼容不同返回格式
      let result = '';
      if (data.message && data.message.content) {
        result = data.message.content;
      } else if (data.choices && data.choices[0] && data.choices[0].message) {
        result = data.choices[0].message.content;
      } else {
        throw new Error('无法解析服务器响应');
      }

      // 将助手回复添加到上下文
      this.addContextMessage('assistant', result);

      return result;
    } catch (error) {
      console.error('AI服务请求失败:', error);
      if (error.response) {
        // 服务器返回错误状态码
        throw new Error(`服务器错误: ${error.response.status} - ${error.response.data?.message || '未知错误'}`);
      } else if (error.request) {
        // 请求发送失败
        throw new Error('无法连接到服务器，请检查网络连接');
      } else {
        // 其他错误
        throw new Error(`请求失败: ${error.message}`);
      }
    }
  }

  /**
   * 模拟解释（用于开发/测试）
   * @param {string} text - 需要解释的文本
   * @returns {Promise<string>} 模拟的解释结果
   */
  async getMockExplanation(text) {
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 500));

    // 简单的模拟回复
    if (text.length < 5) {
      return `"${text}" 可能是一个简短的单词或短语。需要更多上下文才能提供准确解释。`;
    } else {
      return `"${text}" 的解释:\n\n这是一段文本，在实际应用中会由AI模型生成解释。当前使用模拟数据进行展示。`;
    }
  }

  /**
   * 流式解释（SSE）
   * @param {string} text 需要解释的文本
   * @param {{ onDelta?: function, onDone?: function, onError?: function }} handlers 回调
   * @param {object} options 其他配置
   * @returns {Promise<string>} 最终完整文本
   */
  async streamExplanation(text, handlers = {}, options = {}) {
    // 若不支持流式通道，回退到非流式
    if (!ipcClient.isAvailable()) {
      return this.getExplanation(text, options);
    }

    const raw = typeof text === 'string' ? text : '';
    const normalized = raw.trim();
    // 先查缓存，命中则模拟流式增量并返回
    if (ipcClient.isAvailable() && normalized) {
      try {
        const cache = await ipcClient.getCachedAiQuery({ query: normalized });
        if (cache && cache.hit && typeof cache.explanation === 'string') {
          if (typeof handlers.onDelta === 'function') handlers.onDelta(cache.explanation, cache.explanation);
          if (typeof handlers.onDone === 'function') handlers.onDone(cache.explanation, { cached: true });
          return cache.explanation;
        }
      } catch (_) {}
    }

    const { apiKey, apiUrl, model } = await this.getApiConfig();

    // 清空上下文与添加系统提示
    this.clearContext();
    let systemPrompt;
    if (options.language === 'en') {
      systemPrompt = SYSTEM_PROMPT_EN;
    } else {
      // 根据输入类型选择不同的提示词
      const isSentenceInput = isSentence(normalized);
      systemPrompt = isSentenceInput ? FINAL_SYSTEM_PROMPT_ZH_SENTENCE : FINAL_SYSTEM_PROMPT_ZH;
    }
    this.addContextMessage('system', systemPrompt);
    this.addContextMessage('user', text);

    const requestData = {
      model: options.model || model,
      messages: this.context,
      stream: true,
      temperature: options.temperature || 0.7,
      max_tokens: options.max_tokens || 2000
    };

    let fullText = '';
    let unsubscribe = null;

    return new Promise(async (resolve, reject) => {
      try {
        const result = await ipcClient.performAIStream(requestData, apiUrl, apiKey);
        if (!result || result.success !== true) {
          throw new Error(result?.error || '主进程 AI 流式请求失败');
        }
        const { requestId } = result;

        // 监听流事件
        unsubscribe = ipcClient.onAiStream((payload) => {
          try {
            if (!payload || payload.requestId !== requestId) return;
            if (payload.type === 'delta') {
              const piece = payload.content || '';
              fullText += piece;
              if (typeof handlers.onDelta === 'function') handlers.onDelta(piece, fullText);
            } else if (payload.type === 'complete') {
              // 写入上下文并结束
              this.addContextMessage('assistant', fullText);
              if (typeof handlers.onDone === 'function') handlers.onDone(fullText, payload);
              if (unsubscribe) unsubscribe();
              resolve(fullText);
            } else if (payload.type === 'error') {
              if (typeof handlers.onError === 'function') handlers.onError(payload.message);
              if (unsubscribe) unsubscribe();
              reject(new Error(payload.message || '流式错误'));
            }
          } catch (ee) {
            console.error('处理流事件失败:', ee);
          }
        });
      } catch (error) {
        if (unsubscribe) unsubscribe();
        reject(error);
      }
    });
  }

  /**
   * 生成包含今日学习词汇的有意义段落，并添加中文翻译和标签
   * @returns {Promise<string>} 生成的内容，包含 <shengcheng> 标签
   */
  async generateVocabularyStory() {
    // 获取今日查询的词汇记录
    let records = [];
    if (ipcClient.isAvailable()) {
      records = await ipcClient.getAiQueriesToday();
    }
    const words = records.map(r => r.query).join('\n');
    const prompt = 
`这是我今天学到的所有词汇：
${words}

请将这些词汇编写成一个简单而易懂、富有意义的英文段落，突出这些词汇的特点。每句话后面都给出中文翻译，并将生成的段落放入到 <shengcheng> 和 </shengcheng> 标签中。`;
    // 调用通用解释接口生成内容
    return this.getExplanation(prompt, { language: 'zh' });
  }
}

// 创建并导出单例实例
const aiService = new AIService();
export default aiService;
