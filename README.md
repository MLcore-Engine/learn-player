# 视频学习播放器

基于Electron.js和React的视频学习播放器应用。支持播放视频、交互式字幕学习、AI解释和学习时长统计。

## 功能特性

- 视频播放与控制（播放/暂停、音量、速度、全屏）
- 字幕同步显示和交互
- 选择字幕文本获取AI解释
- 学习助手对话界面
- 观看时长统计（总时长、会话时长、当前进度）
- 学习记录保存和查看
- 支持收藏重要解释内容

## 技术栈

- **Electron.js**: 跨平台桌面应用框架
- **React**: 前端UI框架
- **Material-UI**: UI组件库
- **SQLite**: 本地数据存储
- **React-Player**: 视频播放组件
- **subtitle**: 字幕解析库
- **OpenAI API**: 大语言模型集成

## 安装与运行

### 环境要求

- Node.js >= 14
- npm >= 6

### 安装步骤

1. 克隆仓库
   ```
   git clone https://github.com/yourusername/learn-e-player.git
   cd learn-e-player
   ```

2. 安装依赖
   ```
   npm install
   ```

3. 创建环境配置文件
   创建一个 `.env` 文件，参考下面的示例配置：
   
   ```
   # 开发服务器端口
   PORT=3000
   
   # Electron开发URL
   ELECTRON_START_URL=http://localhost:3000
   
   # OpenAI配置
   REACT_APP_OPENAI_API_KEY=your_api_key_here
   REACT_APP_OPENAI_API_URL=https://api.openai.com/v1/chat/completions
   REACT_APP_OPENAI_MODEL=gpt-3.5-turbo
   
   # 视频和数据存储路径 (可选)
   # VIDEOS_PATH=/custom/path/to/videos
   # DATA_PATH=/custom/path/to/data
   ```

4. 运行开发环境
   ```
   npm run dev
   ```

5. 构建应用
   ```
   npm run build
   npm run electron-pack
   ```

## 项目结构

```
learn-e-player/
├── index.js                  # Electron主进程
├── public/                   # 静态资源
│   └── movies/               # 视频存储目录
├── src/                      # 源代码
│   ├── components/           # React组件
│   │   ├── VideoPlayer.js    # 视频播放器组件
│   │   ├── LearningAssistant.js # 学习助手组件
│   │   └── TimeStats.js      # 时长统计组件
│   ├── utils/                # 工具函数
│   │   ├── aiService.js      # AI服务
│   │   └── subtitleParser.js # 字幕解析工具
│   ├── App.js                # 主应用组件
│   ├── App.css               # 应用样式
│   └── index.js              # React入口文件
├── data/                     # 数据存储目录
│   └── userdata.db           # SQLite数据库
└── package.json              # 项目配置
```

## 使用指南

1. 启动应用后，点击"选择视频目录"按钮打开视频文件
2. 应用会自动查找与视频同名的字幕文件（.srt 或 .vtt）
3. 播放视频时，可以点击字幕文本选择单词或句子
4. 学习助手面板会显示选中文本的AI解释
5. 可以直接向学习助手提问进行交互
6. 时长统计会自动记录观看总时长和当前会话时长

## 许可证

AGPL-3.0