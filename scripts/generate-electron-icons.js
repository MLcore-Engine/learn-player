const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 确保目录存在
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// 生成macOS图标
const generateMacIcons = () => {
  const sourceIcon = path.join('assets', 'favicon_le', 'android-chrome-512x512.png');
  const iconsetDir = path.join('assets', 'icon.iconset');
  
  ensureDir(iconsetDir);

  // 生成不同尺寸的图标
  const sizes = [16, 32, 128, 256, 512];
  sizes.forEach(size => {
    // 生成1x和2x尺寸
    execSync(`sips -z ${size} ${size} ${sourceIcon} --out ${iconsetDir}/icon_${size}x${size}.png`);
    execSync(`sips -z ${size*2} ${size*2} ${sourceIcon} --out ${iconsetDir}/icon_${size}x${size}@2x.png`);
  });

  // 生成.icns文件
  execSync(`iconutil -c icns ${iconsetDir} -o assets/icon.icns`);
  console.log('✅ macOS图标生成完成');
};

// 生成Windows图标
const generateWindowsIcons = () => {
  const sourceIcon = path.join('assets', 'favicon_le', 'android-chrome-512x512.png');
  const sizes = [16, 32, 48, 64, 128, 256];
  const sizesStr = sizes.join(',');
  
  execSync(`convert ${sourceIcon} -define icon:auto-resize=${sizesStr} assets/icon.ico`);
  console.log('✅ Windows图标生成完成');
};

// 生成Linux图标
const generateLinuxIcons = () => {
  const sourceIcon = path.join('assets', 'favicon_le', 'android-chrome-512x512.png');
  const sizes = [16, 32, 48, 64, 128, 256, 512];
  
  sizes.forEach(size => {
    execSync(`convert ${sourceIcon} -resize ${size}x${size} assets/icon-${size}.png`);
  });
  console.log('✅ Linux图标生成完成');
};

// 主函数
const main = () => {
  const sourceIcon = path.join('assets', 'favicon_le', 'android-chrome-512x512.png');

  if (!fs.existsSync(sourceIcon)) {
    console.error('❌ 源图标文件不存在！');
    process.exit(1);
  }

  ensureDir('assets');

  // 根据操作系统生成对应的图标
  if (process.platform === 'darwin') {
    generateMacIcons();
    generateWindowsIcons();
    generateLinuxIcons();
  } else if (process.platform === 'win32') {
    generateWindowsIcons();
  } else {
    generateLinuxIcons();
  }
};

main(); 