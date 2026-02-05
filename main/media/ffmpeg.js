const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

/**
 * 获取 FFmpeg 可执行文件路径
 * 支持开发环境和打包后的生产环境
 */
function getFFmpegPath() {
  // 优先使用 @ffmpeg-installer/ffmpeg 提供的路径
  try {
    const installerPath = require('@ffmpeg-installer/ffmpeg').path;
    
    // 检查原始路径
    if (fs.existsSync(installerPath)) {
      console.log('使用 @ffmpeg-installer 路径:', installerPath);
      return installerPath;
    }
    
    // 打包后，asar 解包的路径可能变化
    // 尝试 app.asar.unpacked 路径
    const unpackedPath = installerPath.replace('app.asar', 'app.asar.unpacked');
    if (fs.existsSync(unpackedPath)) {
      console.log('使用 asar.unpacked 路径:', unpackedPath);
      return unpackedPath;
    }
    
    console.log('@ffmpeg-installer 路径不存在:', installerPath);
  } catch (error) {
    console.log('无法加载 @ffmpeg-installer:', error.message);
  }
  
  // 回退：检查系统 PATH 中的 ffmpeg
  const systemFFmpeg = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const { execSync } = require('child_process');
  try {
    const whichCmd = process.platform === 'win32' ? 'where' : 'which';
    const systemPath = execSync(`${whichCmd} ${systemFFmpeg}`).toString().trim().split('\n')[0];
    if (fs.existsSync(systemPath)) {
      console.log('使用系统 FFmpeg:', systemPath);
      return systemPath;
    }
  } catch (e) {
    // 系统没有安装 ffmpeg
  }
  
  return null;
}

// 获取 ffmpeg 路径
const ffmpegPath = getFFmpegPath();

if (!ffmpegPath) {
  console.error('FFmpeg 未找到！视频转换功能将不可用。');
} else {
  // 设置 ffmpeg 路径
  ffmpeg.setFfmpegPath(ffmpegPath);
  ffmpeg.setFfprobePath(ffmpegPath.replace(/ffmpeg(\.exe)?$/, 'ffprobe$1'));
  
  // 验证 ffmpeg 是否可用
  try {
    const { execSync } = require('child_process');
    const version = execSync(`"${ffmpegPath}" -version`).toString();
    console.log('FFmpeg 版本:', version.split('\n')[0]);
  } catch (error) {
    console.error('FFmpeg 验证失败:', error.message);
  }
}

module.exports = {
  ffmpeg,
  ffmpegPath,
  isAvailable: !!ffmpegPath
};
