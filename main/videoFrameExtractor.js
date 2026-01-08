const fs = require('fs');
const path = require('path');
const { app } = require('electron'); // 需要 app 来获取路径
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

// 根据平台选择合适的ffmpeg路径
let ffmpegPath;
if (process.env.DEV_SERVER_URL) {
  // 开发环境使用安装的ffmpeg
  ffmpegPath = ffmpegInstaller.path;
} else {
  // 生产环境使用打包的ffmpeg
  if (process.platform === 'darwin') {
    ffmpegPath = path.join(process.resourcesPath, 'bin', 'ffmpeg');
  } else if (process.platform === 'win32') {
    ffmpegPath = path.join(process.resourcesPath, 'bin', 'ffmpeg.exe');
  } else {
    ffmpegPath = path.join(process.resourcesPath, 'bin', 'ffmpeg');
  }
}

// 设置ffmpeg路径
ffmpeg.setFfmpegPath(ffmpegPath);

// 临时文件存储路径 (使用 userData 目录更可靠)
const tempDir = path.join(app.getPath('userData'), 'tempFrames');

// 确保临时目录存在
if (!fs.existsSync(tempDir)) {
  try {
    fs.mkdirSync(tempDir, { recursive: true });
  } catch (err) {
     console.error('【主进程】创建临时帧目录失败:', err);
     // 如果目录创建失败，后续操作会出错，但至少记录错误
  }
}

/**
 * 从视频中提取特定时间点的帧 (使用 fluent-ffmpeg)
 * @param {string} videoPath - 视频文件路径
 * @param {number} timestamp - 时间戳(秒)
 * @returns {Promise<string>} - 提取的帧图像临时文件路径
 */
function extractFrame(videoPath, timestamp) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(videoPath)) {
      return reject(new Error(`视频文件不存在: ${videoPath}`));
    }

    // 生成唯一的输出文件名
    const outputFileName = `frame_${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`;
    const outputPath = path.join(tempDir, outputFileName);

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
           // 理论上 end 事件后文件应该存在，但还是检查一下
           console.error('【主进程】提取帧成功但输出文件未找到!');
           reject(new Error('提取帧成功但输出文件未找到!'));
        } else {
           resolve(outputPath);
        }
      })
      // 设置截图选项
      .screenshots({
        count: 1,         // 只截取一张图
        timemarks: [timestamp], // 在指定时间戳截图
        filename: outputFileName, // 输出文件名
        folder: tempDir,    // 输出目录
        size: '?x?'       // 保持原始尺寸 (可以指定尺寸如 '320x240')
      });
  });
}

/**
 * 清理临时文件
 * @param {string} filePath - 要删除的文件路径
 */
function cleanupTempFile(filePath) {
  // 基本的路径检查，防止删除临时目录外的文件
  if (!filePath || !filePath.startsWith(tempDir)) {
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

// 应用退出时可以考虑清理整个临时目录
app.on('will-quit', () => {
  try {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log('【主进程】清理整个临时帧目录:', tempDir);
    } 
  } catch (error) {
    console.error('【主进程】退出时清理临时目录失败:', error);
  }
});

module.exports = {
  extractFrame,
  cleanupTempFile,
}; 