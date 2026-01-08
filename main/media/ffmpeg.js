const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

// 设置ffmpeg路径
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffmpegPath);

// 验证ffmpeg路径
if (!fs.existsSync(ffmpegPath)) {
  console.error('FFmpeg路径不存在:', ffmpegPath);
  throw new Error('FFmpeg安装失败，请重新安装应用');
}

console.log('FFmpeg路径:', ffmpegPath);

// 检查ffmpeg是否可用
try {
  const { execSync } = require('child_process');
  const version = execSync(`"${ffmpegPath}" -version`).toString();
  console.log('FFmpeg版本信息:', version.split('\n')[0]);
} catch (error) {
  console.error('FFmpeg验证失败:', error);
  throw new Error('FFmpeg验证失败，请重新安装应用');
}

module.exports = {
  ffmpeg,
  ffmpegPath
};
