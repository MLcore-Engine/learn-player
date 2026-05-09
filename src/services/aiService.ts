import axios, { AxiosError } from 'axios';
import { ipcClient } from './ipcClient';
import resolveAiConfig from './aiConfigService';
import type { ExplanationOptions, StreamHandlers } from '../types/ai';
import type { Highlight, Language } from '../types/highlight';

// 创建 axios 实例
const axiosInstance = axios.create({
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

export interface AiServiceConfig {
  apiKey: string;
  apiUrl: string;
  model: string;
}

export interface AiServiceConstructorOptions {
  apiKey?: string;
  apiUrl?: string;
  modelUrl?: string;
  model?: string;
}

interface ContextMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionChoice {
  message?: { role: string; content: string };
}

interface ChatCompletionResponse {
  message?: { content: string };
  choices?: ChatCompletionChoice[];
}

interface StreamDeltaPayload {
  requestId: string;
  type: 'delta';
  content: string;
}

interface StreamCompletePayload {
  requestId: string;
  type: 'complete';
}

interface StreamErrorPayload {
  requestId: string;
  type: 'error';
  message: string;
}

type StreamEventPayload = StreamDeltaPayload | StreamCompletePayload | StreamErrorPayload;

interface ExplanationRequestOptions extends ExplanationOptions {
  model?: string;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

const defaultConfig: AiServiceConfig = {
  apiKey: '',
  apiUrl: 'https://api.stepfun.com/v1/chat/completions',
  model: 'step-2-mini'
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
  '4. **背景知识**：在美式英语中，"detailed"广泛应用于各种场景。在商务场合，撰写报告时需要提供"detailed information"（详细信息），以确保决策基于充分的数据和事实；在学术写作中，研究成果的阐述要求"detailed analysis"（详细分析），展示研究的严谨性；日常交流中，当人们想要准确传达复杂信息时，也会追求描述得"detailed"。它体现了对信息完整性和精确性的重视。'
];

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
  '   - **borrow** `/ˈbɑro/` **v.** "借入"（borrow...from 表示"从...借来"）'
];

const FINAL_SYSTEM_PROMPT_ZH = [
  ...SYSTEM_PROMPT_ZH,
  '',
  '以下是 few-shot 示例，演示期望的回答格式：',
  ...FEW_SHOT_EXAMPLES_WORD,
  '',
  '请严格按照以上示例格式和要求回答用户的提问。'
].join('\n');

const FINAL_SYSTEM_PROMPT_ZH_SENTENCE = [
  ...SYSTEM_PROMPT_ZH,
  '',
  '以下是 few-shot 示例，演示句子解析的期望格式：',
  ...FEW_SHOT_EXAMPLES_SENTENCE,
  '',
  '请严格按照以上示例格式和要求回答用户的提问。'
].join('\n');

function isSentence(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  const hasSpaces = trimmed.includes(' ');
  const hasPunctuation = /[.!?]/.test(trimmed);
  const wordCount = trimmed.split(/\s+/).filter(w => w.length > 0).length;
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

class AIService {
  private config: AiServiceConfig;
  private context: ContextMessage[];

  constructor(config: AiServiceConstructorOptions = {}) {
    this.config = {
      ...defaultConfig,
      ...config,
      apiUrl: config.modelUrl || config.apiUrl || defaultConfig.apiUrl,
      apiKey: config.apiKey ?? defaultConfig.apiKey,
      model: config.model ?? defaultConfig.model
    };
    this.context = [];
  }

  setModel(model: string): void {
    this.config.model = model;
  }

  clearContext(): void {
    this.context = [];
  }

  addContextMessage(role: ContextMessage['role'], content: string): void {
    this.context.push({ role, content });

    if (this.context.length > 10) {
      const systemMessages = this.context.filter(msg => msg.role === 'system');
      const recentMessages = this.context.slice(-8).filter(msg => msg.role !== 'system');
      this.context = [...systemMessages, ...recentMessages];
    }
  }

  async getApiConfig(): Promise<AiServiceConfig> {
    const { apiKey, apiUrl, model } = await resolveAiConfig({
      apiKey: this.config.apiKey,
      apiUrl: this.config.apiUrl,
      model: this.config.model
    });

    return { apiKey, apiUrl, model };
  }

  async getExplanation(text: string, options: ExplanationRequestOptions = {}): Promise<string> {
    try {
      const raw = typeof text === 'string' ? text : '';
      const normalized = raw.trim();

      const { apiKey, apiUrl, model } = await this.getApiConfig();

      this.clearContext();
      let systemPrompt: string;
      if (options.language === 'en') {
        systemPrompt = SYSTEM_PROMPT_EN;
      } else {
        const isSentenceInput = isSentence(normalized);
        systemPrompt = isSentenceInput ? FINAL_SYSTEM_PROMPT_ZH_SENTENCE : FINAL_SYSTEM_PROMPT_ZH;
      }
      this.addContextMessage('system', systemPrompt);
      this.addContextMessage('user', text);

      const requestData = {
        model: options.model || model,
        messages: this.context,
        stream: options.stream !== undefined ? options.stream : false,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens ?? 2000
      };

      let data: ChatCompletionResponse | undefined;
      if (ipcClient.isAvailable()) {
        const result = await ipcClient.performAIRequest(requestData, apiUrl, apiKey);
        if (!result.success) {
          throw new Error(result.error || '主进程 AI 请求失败');
        }
        data = result.data as ChatCompletionResponse;
      } else {
        const response = await axiosInstance.post<ChatCompletionResponse>(
          apiUrl,
          requestData,
          { headers: { Authorization: `Bearer ${apiKey}` } }
        );
        data = response.data;
      }

      if (!data) {
        throw new Error('服务器返回空响应');
      }

      let result = '';
      if (data.message && data.message.content) {
        result = data.message.content;
      } else if (data.choices && data.choices[0] && data.choices[0].message) {
        result = data.choices[0].message.content;
      } else {
        throw new Error('无法解析服务器响应');
      }

      this.addContextMessage('assistant', result);

      return result;
    } catch (error) {
      console.error('AI服务请求失败:', error);
      const axiosError = error as AxiosError<{ message?: string }>;
      if (axiosError.response) {
        throw new Error(
          `服务器错误: ${axiosError.response.status} - ${axiosError.response.data?.message || '未知错误'}`
        );
      } else if (axiosError.request) {
        throw new Error('无法连接到服务器，请检查网络连接');
      } else {
        throw new Error(`请求失败: ${(error as Error).message}`);
      }
    }
  }

  async getMockExplanation(text: string): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 500));

    if (text.length < 5) {
      return `"${text}" 可能是一个简短的单词或短语。需要更多上下文才能提供准确解释。`;
    } else {
      return `"${text}" 的解释:\n\n这是一段文本，在实际应用中会由AI模型生成解释。当前使用模拟数据进行展示。`;
    }
  }

  async streamExplanation(
    text: string,
    handlers: StreamHandlers = {},
    options: ExplanationRequestOptions = {}
  ): Promise<string> {
    if (!ipcClient.isAvailable()) {
      return this.getExplanation(text, options);
    }

    const raw = typeof text === 'string' ? text : '';
    const normalized = raw.trim();

    const { apiKey, apiUrl, model } = await this.getApiConfig();

    this.clearContext();
    let systemPrompt: string;
    if (options.language === 'en') {
      systemPrompt = SYSTEM_PROMPT_EN;
    } else {
      const isSentenceInput = isSentence(normalized);
      systemPrompt = isSentenceInput ? FINAL_SYSTEM_PROMPT_ZH_SENTENCE : FINAL_SYSTEM_PROMPT_ZH;
    }
    this.addContextMessage('system', systemPrompt);
    this.addContextMessage('user', text);

    const requestData = {
      model: options.model || model,
      messages: this.context,
      stream: true,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 2000
    };

    let fullText = '';
    let unsubscribe: (() => void) | null = null;

    return new Promise<string>((resolve, reject) => {
      (async () => {
        try {
          const result = await ipcClient.performAIStream(requestData, apiUrl, apiKey);
          if (!result || result.success !== true) {
            throw new Error(result?.error || '主进程 AI 流式请求失败');
          }
          const { requestId } = result;

          unsubscribe = ipcClient.onAiStream((...args: unknown[]) => {
            try {
              const payload = args[0] as StreamEventPayload | undefined;
              if (!payload || payload.requestId !== requestId) return;
              if (payload.type === 'delta') {
                const piece = payload.content || '';
                fullText += piece;
                if (typeof handlers.onDelta === 'function') handlers.onDelta(piece, fullText);
              } else if (payload.type === 'complete') {
                this.addContextMessage('assistant', fullText);
                if (typeof handlers.onDone === 'function') handlers.onDone(fullText, payload);
                // 持久化（createHighlight）由 useExplainFlow 在 await 后统一处理；
                // 不在 service 层重复写库。
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
      })();
    });
  }

  async generateVocabularyStory(): Promise<string> {
    let records: { query: string }[] = [];
    if (ipcClient.isAvailable()) {
      const todayHighlights = await ipcClient.getTodayHighlights();
      if (Array.isArray(todayHighlights)) {
        records = (todayHighlights as Highlight[]).map(h => ({ query: h.original_text }));
      }
    }
    if (records.length === 0) {
      throw new Error('今天还没新增单词，无法生成故事');
    }
    const words = records.map(r => r.query).join('\n');
    const prompt = `这是我今天学到的所有词汇：
${words}

请将这些词汇编写成一个简单而易懂、富有意义的英文段落，突出这些词汇的特点。每句话后面都给出中文翻译，并将生成的段落放入到 <shengcheng> 和 </shengcheng> 标签中。`;
    return this.getExplanation(prompt, { language: 'zh' as Language });
  }
}

const aiService = new AIService();
export default aiService;
