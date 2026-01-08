// 移除 Node.js 模块导入
// const { MDX } = require('js-mdict');
// const path = require('path');

function cleanHtml(html) {
  return html
    .replace(/<[^>]+>/g, '') // 移除所有 HTML 标签
    .replace(/&nbsp;/g, ' ') // 替换 &nbsp; 为空格
    .replace(/\s+/g, ' ') // 合并多个空格
    .trim();
}

function extractKKPhonetic(html) {
  // 允许 K.K. 和 [ 之间有任意内容（如 &nbsp;）
  const kkMatch = html.match(/K\.K\.[^\[]*\[<FONT[^>]*>([^<]+)<\/FONT>\]/);
  if (kkMatch) {
    return cleanHtml(kkMatch[1]);
  }
  // 退而求其次，直接匹配中括号内容
  const kkMatch2 = html.match(/K\.K\.[^\[]*\[([^\]]+)\]/);
  return kkMatch2 ? cleanHtml(kkMatch2[1]) : null;
}

function extractDefinitions(html) {
  const definitions = [];
  
  // 定义词性匹配模式
  const patterns = {
    'adj': /adj\.Abbr\.\s*<B>dom\.<\/B>（形容词）缩写\s*<B>dom\.<\/B>([\s\S]*?)(?=n\.Abbr\.|$)/,
    'n': /n\.Abbr\.\s*<B>dom\.<\/B>（名词）缩写\s*<B>dom\.<\/B>([\s\S]*?)(?=v\.Abbr\.|$)/,
    'v': /v\.Abbr\.\s*<B>dom\.<\/B>（动词）缩写\s*<B>dom\.<\/B>([\s\S]*?)(?=adv\.Abbr\.|$)/,
    'adv': /adv\.Abbr\.\s*<B>dom\.<\/B>（副词）缩写\s*<B>dom\.<\/B>([\s\S]*?)(?=prep\.Abbr\.|$)/,
    'prep': /prep\.Abbr\.\s*<B>dom\.<\/B>（介词）缩写\s*<B>dom\.<\/B>([\s\S]*?)(?=conj\.Abbr\.|$)/,
    'conj': /conj\.Abbr\.\s*<B>dom\.<\/B>（连词）缩写\s*<B>dom\.<\/B>([\s\S]*?)(?=pron\.Abbr\.|$)/,
    'pron': /pron\.Abbr\.\s*<B>dom\.<\/B>（代词）缩写\s*<B>dom\.<\/B>([\s\S]*?)(?=art\.Abbr\.|$)/,
    'art': /art\.Abbr\.\s*<B>dom\.<\/B>（冠词）缩写\s*<B>dom\.<\/B>([\s\S]*?)(?=num\.Abbr\.|$)/,
    'num': /num\.Abbr\.\s*<B>dom\.<\/B>（数词）缩写\s*<B>dom\.<\/B>([\s\S]*?)(?=int\.Abbr\.|$)/,
    'int': /int\.Abbr\.\s*<B>dom\.<\/B>（感叹词）缩写\s*<B>dom\.<\/B>([\s\S]*?)(?=语源:|$)/
  };

  // 处理每种词性
  for (const [type, pattern] of Object.entries(patterns)) {
    const match = html.match(pattern);
    if (match) {
      const content = match[1];
      const items = content.match(/<DIV style="WIDTH: 100%">([\s\S]*?)<DIV style="COLOR: #01259a">([\s\S]*?)<\/DIV>/g);
      if (items) {
        items.forEach(item => {
          const engMatch = item.match(/<DIV style="WIDTH: 100%">([\s\S]*?)<DIV style="COLOR: #01259a">/);
          const chnMatch = item.match(/<DIV style="COLOR: #01259a">([\s\S]*?)<\/DIV>/);
          if (engMatch && chnMatch) {
            let english = cleanHtml(engMatch[1]);
            // 只保留第一个序号及其后的内容
            const numbered = english.match(/([1-9][\.|\)]\s*[\s\S]*)/);
            if (numbered) {
              english = numbered[1];
            }
            definitions.push({
              type: type,
              english: english,
              chinese: cleanHtml(chnMatch[1])
            });
          }
        });
      }
    }
  }

  // 如果没有匹配到任何词性，尝试通用结构
  if (definitions.length === 0) {
    const defItems = html.match(/<DIV style="WIDTH: 100%">([\s\S]*?)<DIV style="COLOR: #01259a">([\s\S]*?)<\/DIV>/g);
    if (defItems) {
      defItems.forEach(item => {
        const engMatch = item.match(/<DIV style="WIDTH: 100%">([\s\S]*?)<DIV style="COLOR: #01259a">/);
        const chnMatch = item.match(/<DIV style="COLOR: #01259a">([\s\S]*?)<\/DIV>/);
        if (engMatch && chnMatch) {
          let english = cleanHtml(engMatch[1]);
          // 只保留第一个序号及其后的内容
          const numbered = english.match(/([1-9][\.|\)]\s*[\s\S]*)/);
          if (numbered) {
            english = numbered[1];
          }
          definitions.push({
            type: 'unknown',
            english: english,
            chinese: cleanHtml(chnMatch[1])
          });
        }
      });
    }
  }
  return definitions;
}

function extractSynonyms(html) {
  const synonyms = [];
  const refMatch = html.match(/参考词汇:([\s\S]*?)(?=语源:|$)/);
  if (refMatch) {
    const refContent = refMatch[1];
    const items = refContent.match(/<DIV style="WIDTH: 100%">([\s\S]*?)<DIV style="COLOR: #01259a">([\s\S]*?)<\/DIV>/g);
    if (items) {
      items.forEach(item => {
        const engMatch = item.match(/<DIV style="WIDTH: 100%">([\s\S]*?)<DIV style="COLOR: #01259a">/);
        const chnMatch = item.match(/<DIV style="COLOR: #01259a">([\s\S]*?)<\/DIV>/);
        if (engMatch && chnMatch) {
          synonyms.push({
            english: cleanHtml(engMatch[1]),
            chinese: cleanHtml(chnMatch[1])
          });
        }
      });
    }
  }
  return synonyms;
}

// 添加 KK 音标转码函数
function decodeKK(kk) {
  if (!kk) return kk;
  const map = {
    '6': 'ˈ', // 重音符号
    '7': 'ˌ', // 次重音符号
    '$': 'ə',
    '*': 'ə',
    'd': 'd',
    'm': 'm',
    'n': 'n',
    'W': 'ɛ',
    '%': 'ɔ',
    'i': 'i',
    'I': 'ɪ',
    'e': 'e',
    'E': 'ɛ',
    'æ': 'æ',
    'u': 'u',
    'U': 'ʊ',
    'o': 'o',
    'O': 'ɔ',
    'A': 'ɑ',
    'aɪ': 'aɪ',
    'aʊ': 'aʊ',
    'ɔɪ': 'ɔɪ',
    'ju': 'ju',
    'ɚ': 'ɚ',
    'ɝ': 'ɝ',
    'p': 'p',
    'b': 'b',
    't': 't',
    'k': 'k',
    'g': 'g',
    'f': 'f',
    'v': 'v',
    'θ': 'θ',
    'ð': 'ð',
    's': 's',
    'z': 'z',
    'ʃ': 'ʃ',
    'ʒ': 'ʒ',
    'tʃ': 'tʃ',
    'dʒ': 'dʒ',
    'ŋ': 'ŋ',
    'l': 'l',
    'r': 'r',
    'j': 'j',
    'w': 'w',
    'h': 'h',
    '!': 'ɪ',
    '.': 'ʃ',
    '3': 'ɜ',
    '4': 'ɝ',
    '5': 'ɚ',
    '8': 'ɝ',
    '9': 'ɚ',
    '?': 'ʔ',
    '&': 'æ',
    '@': 'ə',
    '#': 'ʃ',
    '^': 'ʌ',
    '+': 'ŋ',
    '=': 'ʒ',
    '|': 'ɚ',
    '~': 'ŋ',
    '`': 'ˈ',
    ';': 'ˌ'
  };

  // 处理特殊情况
  let result = kk;
  
  // 处理重音符号
  result = result.replace(/6/g, 'ˈ');
  result = result.replace(/7/g, 'ˌ');
  
  // 处理双元音
  result = result.replace(/aI/g, 'aɪ');
  result = result.replace(/aU/g, 'aʊ');
  result = result.replace(/OI/g, 'ɔɪ');
  
  // 处理其他音标
  return result.split('').map(ch => {
    return map[ch] || ch;
  }).join('');
}

class DictionaryService {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    this.initialized = true;
  }

  async lookup(word) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // 通过 IPC 调用主进程进行字典查询
      const result = await window.electronAPI.invoke('lookupWord', word);
      
      if (result.success && result.data) {
        const kk = extractKKPhonetic(result.data);
        const kkPhonetic = decodeKK(kk);
        const definitions = extractDefinitions(result.data);
        const synonyms = extractSynonyms(result.data);
        
        return {
          word: word,
          phonetic: `/${kkPhonetic}/`,
          definitions: definitions,
          synonyms: synonyms
        };
      }
      
      return null;
    } catch (error) {
      console.error('查询单词失败:', error);
      throw error;
    }
  }
}

export default new DictionaryService(); 