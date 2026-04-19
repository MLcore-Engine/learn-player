const fs = require('fs');
const http = require('http');
const path = require('path');
const urlModule = require('url');

const VIDEO_SERVER_PORT = 6459;
let videoServer = null;
let videoServerPort = null;
let videoServerError = null;
let isListening = false;

/**
 * 启动视频 HTTP 服务器。
 * 同步返回：立即创建 server 对象并开始异步监听，允许后续 getVideoServerPort() 调用立即返回。
 * 策略：优先绑定 VIDEO_SERVER_PORT；端口被占时自动回退到 port=0（OS 分配）。
 * 启动失败后会重置状态，下次调用可重试（不会进入永久僵尸状态）。
 */
function startVideoServer() {
  // 如果已有正常工作的 server，直接返回
  if (videoServer && isListening) {
    return;
  }

  // 重置状态，允许重试（上次 listen 失败后不会留下僵尸引用）
  resetServer();

  videoServer = http.createServer(handleRequest);

  // 端口绑定失败时自动回退到 port=0（OS 分配随机可用端口）
  let hasTriedFallback = false;
  videoServer.on('error', (error) => {
    videoServerError = error;
    isListening = false;
    if (error.code === 'EADDRINUSE' && !hasTriedFallback) {
      hasTriedFallback = true;
      console.warn(
        `【主进程】视频 HTTP 服务优先端口 ${VIDEO_SERVER_PORT} 被占用，切换到随机端口...`
      );
      videoServer.close();
      const fallback = http.createServer(handleRequest);
      fallback.on('error', (err) => {
        videoServerError = err;
        isListening = false;
        console.error('【主进程】视频 HTTP 服务（随机端口）启动失败:', err.message);
      });
      fallback.listen(0, '127.0.0.1', () => {
        videoServer = fallback;
        videoServerPort = fallback.address().port;
        isListening = true;
        videoServerError = null;
        console.log(
          `【主进程】视频 HTTP 服务已就绪，随机端口: ${videoServerPort}`
        );
      });
    } else if (!hasTriedFallback) {
      console.error(`【主进程】视频 HTTP 服务启动失败:`, error.message);
    }
  });

  videoServer.listen(VIDEO_SERVER_PORT, '127.0.0.1', () => {
    videoServerPort = VIDEO_SERVER_PORT;
    isListening = true;
    videoServerError = null;
    console.log(`【主进程】视频 HTTP 服务已就绪，端口: ${VIDEO_SERVER_PORT}`);
  });
}

function handleRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }
  const parsedUrl = urlModule.parse(req.url, true);
  if (parsedUrl.pathname !== '/video') {
    res.statusCode = 404;
    return res.end();
  }
  const fileParam = parsedUrl.query.path;
  const decodedPath = decodeURIComponent(fileParam || '');
  const filePath = path.isAbsolute(decodedPath) ? decodedPath : path.resolve(decodedPath);
  if (!fs.existsSync(filePath)) {
    res.statusCode = 404;
    return res.end();
  }
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  if (!range) {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes'
    });
    return fs.createReadStream(filePath).pipe(res);
  }
  const parts = range.replace(/bytes=/, '').split('-');
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
  const chunksize = end - start + 1;
  res.writeHead(206, {
    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': chunksize,
    'Content-Type': 'video/mp4'
  });
  return fs.createReadStream(filePath, { start, end }).pipe(res);
}

/** 重置 server 状态，下次 startVideoServer() 可重新创建 */
function resetServer() {
  if (videoServer) {
    try {
      videoServer.removeAllListeners();
      videoServer.close();
    } catch (_) {
      // ignore close errors
    }
  }
  videoServer = null;
  videoServerPort = null;
  videoServerError = null;
  isListening = false;
}

/**
 * 获取当前可用端口。
 * 如果 server 正在启动中（isListening=false），返回 null；等待后再调用。
 * 如果 server 完全未启动，触发一次 startVideoServer() 后返回 null（下次调用可得端口）。
 * 不再抛异常。
 */
function getVideoServerPort() {
  if (videoServer && isListening) {
    return videoServer.address()?.port || videoServerPort;
  }
  // server 未就绪，尝试触发启动（fire-and-forget）
  if (!videoServer) {
    startVideoServer();
  }
  return null;
}

/** 获取当前错误信息 */
function getVideoServerError() {
  return videoServerError;
}

module.exports = {
  startVideoServer,
  getVideoServerPort,
  getVideoServerError,
  VIDEO_SERVER_PORT
};
