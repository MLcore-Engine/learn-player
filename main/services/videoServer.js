const fs = require('fs');
const http = require('http');
const path = require('path');
const urlModule = require('url');

const VIDEO_SERVER_PORT = 6459;
let videoServer = null;
let videoServerPort = null;
let videoServerError = null;

function startVideoServer(preferredPort = VIDEO_SERVER_PORT) {
  if (videoServer) {
    return { server: videoServer, port: videoServerPort };
  }

  videoServer = http.createServer((req, res) => {
    // 添加 CORS 支持
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    // 处理预检请求
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
      res.writeHead(200, { 'Content-Length': fileSize, 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes' });
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
  });

  videoServer.once('error', (error) => {
    videoServerError = error;
    console.error(`【主进程】视频 HTTP 服务启动失败，端口 ${preferredPort} 不可用:`, error);
  });

  videoServer.listen(preferredPort, '127.0.0.1', () => {
    videoServerPort = videoServer.address().port;
    console.log('【主进程】视频 HTTP 服务启动，端口:', videoServerPort);
  });

  return { server: videoServer, port: videoServerPort };
}

function getVideoServerPort() {
  if (videoServer && videoServer.listening) {
    return videoServer.address().port;
  }
  return videoServerPort;
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
