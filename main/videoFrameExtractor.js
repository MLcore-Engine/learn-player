const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { ffmpeg, ffmpegPath, isAvailable } = require('./media/ffmpeg');

// 临时文件存储路径 (延迟初始化)
let tempDir = null;

function getTempDir() {
  if (!tempDir) {
    tempDir = path.join(app.getPath('userData'), 'tempFrames');
    // 确保临时目录存在
    if (!fs.existsSync(tempDir)) {
      try {
        fs.mkdirSync(tempDir, { recursive: true });
      } catch (err) {
        console.error('【主进程】创建临时帧目录失败:', err);
      }
    }
  }
  return tempDir;
}

/**
 * 从视频中提取特定时间点的帧 (使用 fluent-ffmpeg)
 * @param {string} videoPath - 视频文件路径
 * @param {number} timestamp - 时间戳(秒)
 * @returns {Promise<string>} - 提取的帧图像临时文件路径
 */
function extractFrame(videoPath, timestamp) {
  return new Promise((resolve, reject) => {
    if (!isAvailable) {
      return reject(new Error('FFmpeg 不可用，无法提取视频帧'));
    }
    
    if (!fs.existsSync(videoPath)) {
      return reject(new Error(`视频文件不存在: ${videoPath}`));
    }

    // 生成唯一的输出文件名
    const outputFileName = `frame_${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`;
    const currentTempDir = getTempDir();
    const outputPath = path.join(currentTempDir, outputFileName);

    ffmpeg(videoPath)
      .on('error', (err) => {
        console.error('【主进程】ffmpeg提取帧时出错:', err.message);
        // 尝试清理可能已创建的文件
        cleanupTempFile(outputPath);
        reject(new Error(`提取帧失败: ${err.message}`));
      })
      .on('end', () => {
        console.log('【主进程】成功提取帧:', outputPath);
        if (!fs.existsSync(outputPath)) {
           console.error('【主进程】提取帧成功但输出文件未找到!');
           reject(new Error('提取帧成功但输出文件未找到!'));
        } else {
           resolve(outputPath);
        }
      })
      // 设置截图选项
      .screenshots({
        count: 1,
        timemarks: [timestamp],
        filename: outputFileName,
        folder: currentTempDir,
        size: '?x?'
      });
  });
}

/**
 * 清理临时文件
 * @param {string} filePath - 要删除的文件路径
 */
function cleanupTempFile(filePath) {
  const currentTempDir = getTempDir();
  if (!filePath || !filePath.startsWith(currentTempDir)) {
     console.warn('【主进程】尝试清理无效或非临时的文件路径:', filePath);
     return;
  }
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('【主进程】清理临时文件:', filePath);
    }
  } catch (error) {
    console.error('【主进程】清理临时文件失败:', filePath, error);
  }
}

// 应用退出时清理临时目录（延迟注册事件）
if (app && app.whenReady) {
  app.whenReady().then(() => {
    app.on('will-quit', () => {
      try {
        if (tempDir && fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
          console.log('【主进程】清理整个临时帧目录:', tempDir);
        } 
      } catch (error) {
        console.error('【主进程】退出时清理临时目录失败:', error);
      }
    });
  });
}

module.exports = {
  extractFrame,
  cleanupTempFile,
  isFFmpegAvailable: isAvailable
};
