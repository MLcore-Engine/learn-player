import { ipcClient } from '../services/ipcClient';
import resolveAiConfig from '../services/aiConfigService';

interface StepFunRequestData {
  model: string;
  messages: Array<{
    role: string;
    content: Array<
      | { type: 'image_url'; image_url: { url: string } }
      | { type: 'text'; text: string }
    >;
  }>;
  temperature: number;
  max_tokens: number;
}

interface CustomOcrRequestData {
  task: string;
  mode: string;
  image: string;
  language: string;
  meta: { region: string; scale: number };
}

interface OcrResponsePayload {
  text?: string;
  data?: { text?: string };
  result?: { text?: string };
  choices?: Array<{ message?: { content?: string } }>;
}

async function recognizeViaServer(imageDataUrl: string): Promise<string> {
  if (!ipcClient.isAvailable()) {
    throw new Error('electronAPI 不可用');
  }

  const cfg = await resolveAiConfig({ requireApiKey: true });
  const apiKey = cfg.apiKey || '';
  const baseUrl = cfg.apiUrl || '';

  let isStepFun = false;
  try {
    const u = new URL(baseUrl);
    isStepFun = /(^|\.)stepfun\.com$/.test(u.hostname);
  } catch {
    isStepFun = baseUrl.includes('stepfun.com');
  }

  let performUrl = '';
  let requestData: StepFunRequestData | CustomOcrRequestData;
  if (isStepFun) {
    performUrl = baseUrl;
    requestData = {
      model: 'step-1v-8k',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageDataUrl } },
            {
              type: 'text',
              text: 'Please extract and return ONLY the English subtitle text from the bottom area of this image. Focus on the subtitle region (typically bottom 15-18% of the image). Remove timestamps, speaker labels, or formatting codes. Return only clean English text. If none, return empty string.'
            }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 500
    };
  } else {
    performUrl = baseUrl;
    try {
      performUrl = new URL('/api/vision-ocr', baseUrl).toString();
    } catch {
      /* ignore */
    }
    requestData = {
      task: 'subtitle_ocr',
      mode: 'ocr',
      image: imageDataUrl,
      language: 'eng',
      meta: { region: 'bottom_10_percent', scale: 2 }
    };
  }

  const result = await ipcClient.performAIRequest(requestData, performUrl, apiKey);
  if (!result || result.success !== true) {
    throw new Error(result?.error || '服务端 OCR 请求失败');
  }

  const payload = result.data as OcrResponsePayload | undefined;
  const candidates: Array<string | undefined> = [
    payload?.text,
    payload?.data?.text,
    payload?.result?.text,
    payload?.choices?.[0]?.message?.content
  ];
  const text = candidates.find((t): t is string => typeof t === 'string' && t.trim().length > 0) || '';
  return text;
}

function postprocessOcrText(text: string): string {
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

export async function recognizeSubtitleFromVideo(videoElement: HTMLVideoElement): Promise<string> {
  if (!videoElement.videoWidth || !videoElement.videoHeight) {
    throw new Error('视频尺寸未就绪');
  }

  await new Promise(resolve => setTimeout(resolve, 100));

  const width = videoElement.videoWidth;
  const height = videoElement.videoHeight;

  console.log('【OCR】视频尺寸:', {
    width, height,
    displayWidth: videoElement.clientWidth,
    displayHeight: videoElement.clientHeight
  });

  const cropHeight = Math.floor(height * 0.20);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = cropHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas context unavailable');
  }

  const startY = Math.max(0, height - cropHeight - Math.floor(height * 0.03));
  console.log('【OCR】截图区域:', { startY, cropHeight, height });

  ctx.drawImage(videoElement, 0, startY, width, cropHeight, 0, 0, width, cropHeight);

  const scaleFactor = 2;
  const scaledCanvas = document.createElement('canvas');
  const scaledWidth = width * scaleFactor;
  const scaledHeight = cropHeight * scaleFactor;
  scaledCanvas.width = scaledWidth;
  scaledCanvas.height = scaledHeight;
  const scaledCtx = scaledCanvas.getContext('2d');
  if (!scaledCtx) {
    throw new Error('Canvas context unavailable');
  }
  scaledCtx.imageSmoothingEnabled = false;
  scaledCtx.drawImage(canvas, 0, 0, scaledWidth, scaledHeight);

  const imageData = scaledCtx.getImageData(0, 0, scaledWidth, scaledHeight);
  const data = imageData.data;
  const threshold = 200;

  for (let i = 0; i < data.length; i += 4) {
    const avg = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const color = avg < threshold ? 0 : 255;
    data[i] = color;
    data[i + 1] = color;
    data[i + 2] = color;
  }

  scaledCtx.putImageData(imageData, 0, 0);

  const dataUrl = scaledCanvas.toDataURL('image/jpeg', 0.6);

  try {
    const serverText = await recognizeViaServer(dataUrl);
    const cleanedServerText = postprocessOcrText(serverText);
    if (cleanedServerText) {
      console.log('【OCR】服务端识别结果:', cleanedServerText);
      return cleanedServerText;
    }
  } catch (e) {
    console.warn('【OCR】服务端识别失败：', (e as Error)?.message || e);
    throw e;
  }

  return '';
}
