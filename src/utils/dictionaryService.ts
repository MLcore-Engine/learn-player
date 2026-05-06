import { ipcClient } from '../services/ipcClient';

export interface DictionaryDefinition {
  type: string;
  english: string;
  chinese: string;
}

export interface DictionarySynonym {
  english: string;
  chinese: string;
}

export interface DictionaryResult {
  word: string;
  phonetic: string;
  definitions: DictionaryDefinition[];
  synonyms: DictionarySynonym[];
}

interface LookupWordRawResult {
  success?: boolean;
  data?: string;
  error?: string;
}

function cleanHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractKKPhonetic(html: string): string | null {
  const kkMatch = html.match(/K\.K\.[^\[]*\[<FONT[^>]*>([^<]+)<\/FONT>\]/);
  if (kkMatch) {
    return cleanHtml(kkMatch[1]);
  }
  const kkMatch2 = html.match(/K\.K\.[^\[]*\[([^\]]+)\]/);
  return kkMatch2 ? cleanHtml(kkMatch2[1]) : null;
}

function extractDefinitions(html: string): DictionaryDefinition[] {
  const definitions: DictionaryDefinition[] = [];
  const patterns: Record<string, RegExp> = {
    adj: /adj\.Abbr\.\s*<B>dom\.<\/B>（形容词）缩写\s*<B>dom\.<\/B>([\s\S]*?)(?=n\.Abbr\.|$)/,
    n: /n\.Abbr\.\s*<B>dom\.<\/B>（名词）缩写\s*<B>dom\.<\/B>([\s\S]*?)(?=v\.Abbr\.|$)/,
    v: /v\.Abbr\.\s*<B>dom\.<\/B>（动词）缩写\s*<B>dom\.<\/B>([\s\S]*?)(?=adv\.Abbr\.|$)/,
    adv: /adv\.Abbr\.\s*<B>dom\.<\/B>（副词）缩写\s*<B>dom\.<\/B>([\s\S]*?)(?=prep\.Abbr\.|$)/,
    prep: /prep\.Abbr\.\s*<B>dom\.<\/B>（介词）缩写\s*<B>dom\.<\/B>([\s\S]*?)(?=conj\.Abbr\.|$)/,
    conj: /conj\.Abbr\.\s*<B>dom\.<\/B>（连词）缩写\s*<B>dom\.<\/B>([\s\S]*?)(?=pron\.Abbr\.|$)/,
    pron: /pron\.Abbr\.\s*<B>dom\.<\/B>（代词）缩写\s*<B>dom\.<\/B>([\s\S]*?)(?=art\.Abbr\.|$)/,
    art: /art\.Abbr\.\s*<B>dom\.<\/B>（冠词）缩写\s*<B>dom\.<\/B>([\s\S]*?)(?=num\.Abbr\.|$)/,
    num: /num\.Abbr\.\s*<B>dom\.<\/B>（数词）缩写\s*<B>dom\.<\/B>([\s\S]*?)(?=int\.Abbr\.|$)/,
    int: /int\.Abbr\.\s*<B>dom\.<\/B>（感叹词）缩写\s*<B>dom\.<\/B>([\s\S]*?)(?=语源:|$)/
  };

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
            const numbered = english.match(/([1-9][\.|\)]\s*[\s\S]*)/);
            if (numbered) {
              english = numbered[1];
            }
            definitions.push({ type, english, chinese: cleanHtml(chnMatch[1]) });
          }
        });
      }
    }
  }

  if (definitions.length === 0) {
    const defItems = html.match(/<DIV style="WIDTH: 100%">([\s\S]*?)<DIV style="COLOR: #01259a">([\s\S]*?)<\/DIV>/g);
    if (defItems) {
      defItems.forEach(item => {
        const engMatch = item.match(/<DIV style="WIDTH: 100%">([\s\S]*?)<DIV style="COLOR: #01259a">/);
        const chnMatch = item.match(/<DIV style="COLOR: #01259a">([\s\S]*?)<\/DIV>/);
        if (engMatch && chnMatch) {
          let english = cleanHtml(engMatch[1]);
          const numbered = english.match(/([1-9][\.|\)]\s*[\s\S]*)/);
          if (numbered) {
            english = numbered[1];
          }
          definitions.push({ type: 'unknown', english, chinese: cleanHtml(chnMatch[1]) });
        }
      });
    }
  }
  return definitions;
}

function extractSynonyms(html: string): DictionarySynonym[] {
  const synonyms: DictionarySynonym[] = [];
  const refMatch = html.match(/参考词汇:([\s\S]*?)(?=语源:|$)/);
  if (refMatch) {
    const refContent = refMatch[1];
    const items = refContent.match(/<DIV style="WIDTH: 100%">([\s\S]*?)<DIV style="COLOR: #01259a">([\s\S]*?)<\/DIV>/g);
    if (items) {
      items.forEach(item => {
        const engMatch = item.match(/<DIV style="WIDTH: 100%">([\s\S]*?)<DIV style="COLOR: #01259a">/);
        const chnMatch = item.match(/<DIV style="COLOR: #01259a">([\s\S]*?)<\/DIV>/);
        if (engMatch && chnMatch) {
          synonyms.push({ english: cleanHtml(engMatch[1]), chinese: cleanHtml(chnMatch[1]) });
        }
      });
    }
  }
  return synonyms;
}

function decodeKK(kk: string | null): string | null {
  if (!kk) return kk;
  const map: Record<string, string> = {
    '6': 'ˈ', '7': 'ˌ', '$': 'ə', '*': 'ə',
    d: 'd', m: 'm', n: 'n', W: 'ɛ',
    '%': 'ɔ', i: 'i', I: 'ɪ', e: 'e', E: 'ɛ',
    æ: 'æ', u: 'u', U: 'ʊ', o: 'o', O: 'ɔ', A: 'ɑ',
    aɪ: 'aɪ', aʊ: 'aʊ', ɔɪ: 'ɔɪ', ju: 'ju', ɚ: 'ɚ', ɝ: 'ɝ',
    p: 'p', b: 'b', t: 't', k: 'k', g: 'g', f: 'f', v: 'v',
    θ: 'θ', ð: 'ð', s: 's', z: 'z', ʃ: 'ʃ', ʒ: 'ʒ',
    tʃ: 'tʃ', dʒ: 'dʒ', ŋ: 'ŋ', l: 'l', r: 'r', j: 'j', w: 'w', h: 'h',
    '!': 'ɪ', '.': 'ʃ', '3': 'ɜ', '4': 'ɝ', '5': 'ɚ',
    '8': 'ɝ', '9': 'ɚ', '?': 'ʔ', '&': 'æ', '@': 'ə',
    '#': 'ʃ', '^': 'ʌ', '+': 'ŋ', '=': 'ʒ', '|': 'ɚ',
    '~': 'ŋ', '`': 'ˈ', ';': 'ˌ'
  };

  let result = kk;
  result = result.replace(/6/g, 'ˈ');
  result = result.replace(/7/g, 'ˌ');
  result = result.replace(/aI/g, 'aɪ');
  result = result.replace(/aU/g, 'aʊ');
  result = result.replace(/OI/g, 'ɔɪ');

  return result.split('').map(ch => map[ch] || ch).join('');
}

class DictionaryService {
  private initialized: boolean;

  constructor() {
    this.initialized = false;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
  }

  async lookup(word: string): Promise<DictionaryResult | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const result = (await ipcClient.lookupWord(word)) as LookupWordRawResult | null | undefined;

      if (result && result.success && result.data) {
        const kk = extractKKPhonetic(result.data);
        const kkPhonetic = decodeKK(kk);
        const definitions = extractDefinitions(result.data);
        const synonyms = extractSynonyms(result.data);

        return {
          word,
          phonetic: `/${kkPhonetic ?? ''}/`,
          definitions,
          synonyms
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
