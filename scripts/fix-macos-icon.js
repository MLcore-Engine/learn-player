/**
 * 修复 macOS 图标 - 添加适当的边距
 * macOS 图标规范要求图标内容周围有约 10% 的透明边距
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');
const sourceIcon = path.join(assetsDir, 'icon-512.png');
const iconsetDir = path.join(assetsDir, 'icon.iconset');

// macOS 图标尺寸规范
const sizes = [
  { size: 16, scale: 1, name: 'icon_16x16.png' },
  { size: 16, scale: 2, name: 'icon_16x16@2x.png' },
  { size: 32, scale: 1, name: 'icon_32x32.png' },
  { size: 32, scale: 2, name: 'icon_32x32@2x.png' },
  { size: 128, scale: 1, name: 'icon_128x128.png' },
  { size: 128, scale: 2, name: 'icon_128x128@2x.png' },
  { size: 256, scale: 1, name: 'icon_256x256.png' },
  { size: 256, scale: 2, name: 'icon_256x256@2x.png' },
  { size: 512, scale: 1, name: 'icon_512x512.png' },
  { size: 512, scale: 2, name: 'icon_512x512@2x.png' },
];

// 内边距比例 (macOS 建议 ~10%)
const PADDING_RATIO = 0.1;

console.log('🎨 开始修复 macOS 图标...\n');

// 确保 iconset 目录存在
if (!fs.existsSync(iconsetDir)) {
  fs.mkdirSync(iconsetDir, { recursive: true });
}

// 检查源图标是否存在
if (!fs.existsSync(sourceIcon)) {
  console.error('❌ 源图标不存在:', sourceIcon);
  process.exit(1);
}

// 生成各尺寸图标（带边距）
for (const { size, scale, name } of sizes) {
  const outputSize = size * scale;
  const iconSize = Math.round(outputSize * (1 - PADDING_RATIO * 2)); // 图标实际大小
  const outputPath = path.join(iconsetDir, name);
  
  try {
    // 使用 sips 命令：
    // 1. 先将源图标缩放到目标尺寸（带边距）
    // 2. 创建透明画布
    // 3. 将图标居中放置
    
    const tempIcon = path.join(iconsetDir, `temp_${name}`);
    const tempCanvas = path.join(iconsetDir, `canvas_${name}`);
    
    // 缩放图标到内容尺寸
    execSync(`sips -z ${iconSize} ${iconSize} "${sourceIcon}" --out "${tempIcon}" 2>/dev/null`);
    
    // 创建透明画布并将图标居中
    // 使用 ImageMagick 的 convert 命令（如果可用）
    try {
      execSync(`convert -size ${outputSize}x${outputSize} xc:transparent "${tempIcon}" -gravity center -composite "${outputPath}" 2>/dev/null`);
      fs.unlinkSync(tempIcon);
    } catch (e) {
      // 如果没有 ImageMagick，使用备用方案
      // 直接使用 sips 添加边距（通过 padToHeightWidth）
      execSync(`sips -p ${outputSize} ${outputSize} "${tempIcon}" --out "${outputPath}" 2>/dev/null`);
      fs.unlinkSync(tempIcon);
    }
    
    console.log(`✅ 生成 ${name} (${outputSize}x${outputSize})`);
  } catch (error) {
    console.error(`❌ 生成 ${name} 失败:`, error.message);
  }
}

// 生成 .icns 文件
console.log('\n📦 生成 icon.icns...');
try {
  const icnsPath = path.join(assetsDir, 'icon.icns');
  execSync(`iconutil -c icns "${iconsetDir}" -o "${icnsPath}"`);
  console.log('✅ icon.icns 生成成功');
} catch (error) {
  console.error('❌ 生成 icon.icns 失败:', error.message);
}

// 同时更新其他尺寸的 PNG 图标
console.log('\n🖼️  更新 PNG 图标...');
const pngSizes = [16, 32, 48, 64, 128, 256, 512];
for (const size of pngSizes) {
  const iconSize = Math.round(size * (1 - PADDING_RATIO * 2));
  const outputPath = path.join(assetsDir, `icon-${size}.png`);
  const tempIcon = path.join(assetsDir, `temp-${size}.png`);
  
  try {
    execSync(`sips -z ${iconSize} ${iconSize} "${sourceIcon}" --out "${tempIcon}" 2>/dev/null`);
    
    try {
      execSync(`convert -size ${size}x${size} xc:transparent "${tempIcon}" -gravity center -composite "${outputPath}" 2>/dev/null`);
    } catch (e) {
      execSync(`sips -p ${size} ${size} "${tempIcon}" --out "${outputPath}" 2>/dev/null`);
    }
    
    if (fs.existsSync(tempIcon)) fs.unlinkSync(tempIcon);
    console.log(`✅ icon-${size}.png`);
  } catch (error) {
    console.error(`❌ icon-${size}.png 失败`);
  }
}

console.log('\n✨ 图标修复完成！请重新构建应用。');
