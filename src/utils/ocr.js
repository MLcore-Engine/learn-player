import { ipcClient } from '../services/ipcClient';
import resolveAiConfig from '../services/aiConfigService';

// 使用服务端中转进行 OCR 的辅助函数
// 期望服务端接口(建议)：POST /api/vision-ocr
// Header: Authorization: Bearer <apiKey>
// Body(JSON): {
//   task: 'subtitle_ocr',
//   mode: 'ocr' | 'vision',
//   image: 'data:image/png;base64,...',
//   language: 'eng',
//   meta: { region: 'bottom_10_percent', scale: 2 }
// }
// 响应(JSON) 推荐之一：{ text: string, usage?: {...}, requestId?: string }
// 兼容其他格式：{ data: { text } } 或 { result: { text } }

async function recognizeViaServer(imageDataUrl) {
  if (!ipcClient.isAvailable()) {
    throw new Error('electronAPI 不可用');
  }

  const cfg = await resolveAiConfig({ requireApiKey: true });
  const apiKey = cfg.apiKey || '';
  const baseUrl = cfg.apiUrl || '';

  // 如果是智谱官方地址，直接调用 GLM-4V-Flash（chat completions）
  let isZhipu = false;
  try {
    const u = new URL(baseUrl);
    isZhipu = /(^|\.)bigmodel\.cn$/.test(u.hostname);
  } catch (_) {
    isZhipu = baseUrl.includes('bigmodel.cn');
  }

  let performUrl = '';
  let requestData;
  if (isZhipu) {
    performUrl = baseUrl; // 直接使用智谱 chat completions 地址
    requestData = {
      model: 'GLM-4V-Flash',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageDataUrl }
            },
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
    // 自建服务：将 modelUrl 的主机作为 OCR 服务基址，路径统一为 /api/vision-ocr
    performUrl = baseUrl;
    try {
      performUrl = new URL('/api/vision-ocr', baseUrl).toString();
    } catch (_) {}
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

  const payload = result.data;
  const candidates = [
    payload?.text,
    payload?.data?.text,
    payload?.result?.text,
    payload?.choices?.[0]?.message?.content
  ];
  const text = candidates.find(t => typeof t === 'string' && t.trim().length > 0) || '';
  return text;
}

function postprocessOcrText(text) {
  let cleanedText = (text || '')
    .replace(/\s+/g, ' ')
    .trim();

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

/**
 * 从 video 元素中截取底部 15% 区域并进行 OCR 识别
 * @param {HTMLVideoElement} videoElement 视频元素引用
 * @returns {Promise<string>} 识别出的英文字幕文本
 */
export async function recognizeSubtitleFromVideo(videoElement) {
  // 确保视频已加载元数据
  if (!videoElement.videoWidth || !videoElement.videoHeight) {
    throw new Error('视频尺寸未就绪');
  }

  // 等待视频帧渲染完成（确保当前帧已绘制到画面）
  await new Promise(resolve => setTimeout(resolve, 100));

  const width = videoElement.videoWidth;
  const height = videoElement.videoHeight;
  
  console.log('【OCR】视频尺寸:', { width, height, displayWidth: videoElement.clientWidth, displayHeight: videoElement.clientHeight });
  
  // 扩大识别区域以支持双行字幕，改为底部 20%（增加覆盖范围）
  const cropHeight = Math.floor(height * 0.20);

  // 创建临时 canvas 进行截图
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = cropHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas context unavailable');
  }
  
  // 截取底部区域，上移 3% 以确保完全捕捉字幕（包括双行字幕的上一行）
  // 从视频底部向上截取 20% 的区域，起始位置稍微上移 3% 作为安全边距
  const startY = Math.max(0, height - cropHeight - Math.floor(height * 0.03));
  
  console.log('【OCR】截图区域:', { startY, cropHeight, height });
  
  ctx.drawImage(
    videoElement,
    0,
    startY,
    width,
    cropHeight,
    0,
    0,
    width,
    cropHeight
  );

  // --- 图像预处理 ---
  // 1. 提升图像分辨率 (放大2倍)
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
  scaledCtx.imageSmoothingEnabled = false; // 禁用平滑以保持边缘清晰
  scaledCtx.drawImage(canvas, 0, 0, scaledWidth, scaledHeight);

  // 2. 图像二值化
  // 注意：这是一个简单的固定阈值方法。对于不同颜色或亮度的字幕，效果可能不稳定。
  // 更高级的方法是"自适应阈值"，但这在前端 Canvas 中实现复杂。
  // 这里的阈值(200)是基于"亮色文字、暗色背景"的常见假设。
  const imageData = scaledCtx.getImageData(0, 0, scaledWidth, scaledHeight);
  const data = imageData.data;
  const threshold = 200; 

  for (let i = 0; i < data.length; i += 4) {
    // 使用加权平均法计算灰度值，更符合人眼感知
    const avg = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    
    // 如果灰度值低于阈值，设为黑色；否则设为白色
    const color = avg < threshold ? 0 : 255;
    data[i] = color;     // Red
    data[i + 1] = color; // Green
    data[i + 2] = color; // Blue
  }

  scaledCtx.putImageData(imageData, 0, 0);
  // --- 预处理结束 ---

  // 转成 dataURL 供服务端识别（使用 JPEG 压缩以降低传输体积）
  const dataUrl = scaledCanvas.toDataURL('image/jpeg', 0.6);

  // 优先使用服务端 OCR（经由自有中转服务，便于用户管理/计费/权限）
  try {
    const serverText = await recognizeViaServer(dataUrl);
    const cleanedServerText = postprocessOcrText(serverText);
    if (cleanedServerText) {
      console.log('【OCR】服务端识别结果:', cleanedServerText);
      return cleanedServerText;
    }
  } catch (e) {
    console.warn('【OCR】服务端识别失败：', e?.message || e);
    throw e;
  }

  // 若服务端无结果，返回空串（上层会提示"未检测到字幕"）
  return '';
}
