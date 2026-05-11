const fs = require('fs');
const http = require('http');
const path = require('path');
const urlModule = require('url');

const VIDEO_SERVER_PORT = 6459;
let videoServer = null;
let videoServerPort = null;
let videoServerError = null;
let isListening = false;

// 按扩展名返回合适的 MIME，保证 <video> 元素能正确识别。
const MIME_BY_EXT = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.ts': 'video/mp2t',
  '.avi': 'video/x-msvideo',
  '.flv': 'video/x-flv',
  '.wmv': 'video/x-ms-wmv'
};

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_BY_EXT[ext] || 'video/mp4';
}

/**
 * 启动视频 HTTP 服务器。
 * 优先绑定固定端口；被占用时自动回退到随机可用端口，避免永久卡死。
 */
function startVideoServer() {
  if (videoServer && isListening) {
    return;
  }

  resetServer();
  videoServer = http.createServer(handleRequest);

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
        console.log(`【主进程】视频 HTTP 服务已就绪，随机端口: ${videoServerPort}`);
      });
      return;
    }

    console.error('【主进程】视频 HTTP 服务启动失败:', error.message);
    resetServer();
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
  const contentType = mimeFor(filePath);
  const range = req.headers.range;
  if (!range) {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
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
    'Content-Type': contentType
  });
  return fs.createReadStream(filePath, { start, end }).pipe(res);
}

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

function getVideoServerPort() {
  if (videoServer && isListening) {
    return videoServer.address()?.port || videoServerPort;
  }

  if (!videoServer) {
    startVideoServer();
  }

  return null;
}

function getVideoServerError() {
  return videoServerError;
}

module.exports = {
  startVideoServer,
  getVideoServerPort,
  getVideoServerError,
  VIDEO_SERVER_PORT
};
