const fs = require('fs');
const path = require('path');

// 确保目录存在
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// 创建必要的目录
const createDirectories = () => {
  const dirs = [
    'dist/mac-arm64/lep.app/Contents/Resources/db',
    'dist/mac/lep.app/Contents/Resources/db',
    'dist/win-unpacked/resources/db',
    'dist/linux-unpacked/resources/db'
  ];

  dirs.forEach(dir => {
    ensureDir(dir);
    console.log(`✅ 创建目录: ${dir}`);
  });
};

// 复制必要文件
const copyFiles = () => {
  // 复制数据库文件（如果存在）
  const dbPath = path.join('data', 'userdata.db');
  if (fs.existsSync(dbPath)) {
    const targetDirs = [
      'dist/mac-arm64/lep.app/Contents/Resources/db',
      'dist/mac/lep.app/Contents/Resources/db',
      'dist/win-unpacked/resources/db',
      'dist/linux-unpacked/resources/db'
    ];

    targetDirs.forEach(dir => {
      const targetPath = path.join(dir, 'userdata.db');
      fs.copyFileSync(dbPath, targetPath);
      console.log(`✅ 复制数据库文件到: ${targetPath}`);
    });
  }
};

// 主函数
const main = () => {
  console.log('🚀 开始准备构建...');
  createDirectories();
  copyFiles();
  console.log('✅ 构建准备完成');
};

main(); 