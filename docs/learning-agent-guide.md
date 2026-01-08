# 学习Agent使用指南

## 概述

学习Agent是一个智能英语学习助手系统，集成了以下核心功能：

1. **学习分析** - 分析用户的学习数据，包括学习时长、单词查询频率、学习进度等
2. **学习计划** - 使用大语言模型生成个性化学习计划
3. **背单词** - 基于Anki式间隔重复算法（SM-2）的智能背单词系统

## 技术架构

### 数据库表结构

#### 1. vocabulary（词汇表）
存储单词及其学习进度：
- `id`: 主键
- `word`: 单词（唯一）
- `phonetic`: 音标
- `meaning`: 含义
- `example`: 例句
- `explanation`: AI解释
- `ease`: 易度因子（SM-2算法）
- `interval`: 复习间隔（天）
- `repetitions`: 复习次数
- `next_review`: 下次复习时间
- `last_review`: 上次复习时间

#### 2. vocabulary_reviews（复习记录表）
记录每次复习的详细信息：
- `vocabulary_id`: 单词ID
- `quality`: 评分（0-3）
- `ease_before/after`: 易度因子变化
- `interval_before/after`: 间隔变化

#### 3. study_plans（学习计划表）
存储AI生成的学习计划：
- `plan_data`: 计划文本内容
- `structured_plan`: 结构化计划数据（JSON）
- `days`: 计划天数
- `status`: 状态（active/completed）
- `progress`: 完成进度（0-100）

### 服务层

#### learningAnalyticsService.js
提供学习数据分析功能：
- `getLearningOverview()` - 获取学习概况
- `analyzeLearningPattern()` - 分析学习模式
- `getLearningReport(options)` - 获取学习报告
- `getWordFrequencyStats(limit)` - 获取单词频率统计

#### studyPlanService.js
提供学习计划生成和管理：
- `generateStudyPlan(electronAPI, options)` - 生成学习计划
- `getCurrentStudyPlan(electronAPI)` - 获取当前计划
- `updatePlanProgress(electronAPI, progress)` - 更新进度

#### spacedRepetitionService.js
实现SM-2间隔重复算法：
- `getWordsToReview(electronAPI, limit)` - 获取需要复习的单词
- `submitReview(electronAPI, wordId, quality)` - 提交复习结果
- `addWord(electronAPI, wordData)` - 添加单词
- `extractWordsFromQueries(electronAPI, limit)` - 从查询记录提取单词
- `getLearningStats(electronAPI)` - 获取学习统计

## SM-2算法说明

### 算法参数
- **初始易度因子**: 2.5
- **最小易度因子**: 1.3
- **易度变化量**: 0.15
- **评分等级**:
  - 0: 重来（Again）
  - 1: 困难（Hard）
  - 2: 良好（Good）
  - 3: 简单（Easy）

### 间隔计算规则
1. **重来（0）或困难（1）**：
   - 降低易度因子
   - 重置复习次数为0
   - 间隔设为1天

2. **良好（2）或简单（3）**：
   - 增加易度因子（简单时更明显）
   - 增加复习次数
   - 计算新间隔：
     - 第1次复习: 1天
     - 第2次复习: 6天
     - 第3次及以上: `interval * ease`（天）

## 使用流程

### 1. 学习分析

查看学习概况和学习模式：
- 总学习时长
- 总查询单词数
- 学习天数
- 今日查询数
- 最活跃时段
- 学习频率
- 最近趋势

### 2. 生成学习计划

1. 点击"生成新计划"按钮
2. 系统会分析你的学习数据
3. 调用大语言模型生成个性化学习计划
4. 计划包含：
   - 每日学习目标
   - 单词学习计划
   - 视频学习计划
   - 复习安排
   - 学习建议

### 3. 背单词

#### 初始设置
1. **提取单词**：点击"从查询记录提取单词"，系统会自动从你的AI查询记录中提取单词

#### 复习流程
1. 查看单词（不显示答案）
2. 点击"显示答案"查看详细信息
3. 根据记忆情况选择评分：
   - **重来**：完全不记得
   - **困难**：需要提示才能想起
   - **良好**：能正确回忆
   - **简单**：非常熟悉
4. 系统根据评分自动计算下次复习时间
5. 继续下一个单词

#### 复习策略
- 系统会根据SM-2算法自动安排复习时间
- 记忆越牢固，复习间隔越长
- 记忆不牢固，会缩短间隔频繁复习

## UI组件使用

### LearningAgent组件

在应用中使用：

```jsx
import LearningAgent from './components/LearningAgent';

// 在页面中渲染
<LearningAgent />
```

组件包含三个标签页：
1. **学习分析** - 显示学习数据和统计
2. **学习计划** - 显示和管理学习计划
3. **背单词** - 间隔重复复习界面

## API接口

所有API通过 `window.electronAPI` 调用：

### 学习分析
```javascript
// 获取学习概况
const overview = await window.electronAPI.getLearningOverview();

// 分析学习模式
const pattern = await window.electronAPI.analyzeLearningPattern();

// 获取学习报告
const report = await window.electronAPI.getLearningReport({ days: 7 });

// 获取单词频率统计
const stats = await window.electronAPI.getWordFrequencyStats({ limit: 50 });
```

### 学习计划
```javascript
// 保存学习计划
await window.electronAPI.saveStudyPlan({
  planData: '计划文本...',
  structuredPlan: { /* 结构化数据 */ },
  days: 7
});

// 获取当前计划
const plan = await window.electronAPI.getCurrentStudyPlan();

// 更新进度
await window.electronAPI.updatePlanProgress({ progress: 50 });
```

### 背单词
```javascript
// 获取需要复习的单词
const words = await window.electronAPI.getWordsToReview({ limit: 20 });

// 提交复习结果
await window.electronAPI.updateVocabularyCard({
  wordId: 1,
  ease: 2.5,
  interval: 6,
  repetitions: 2,
  nextReview: '2024-01-01T00:00:00.000Z',
  lastReview: '2023-12-25T00:00:00.000Z',
  quality: 2  // 0-3
});

// 添加单词
await window.electronAPI.addVocabularyWord({
  word: 'example',
  phonetic: '/ɪgˈzæmpl/',
  meaning: '例子',
  example: 'This is an example.',
  explanation: 'AI解释内容...'
});

// 从查询记录提取单词
const result = await window.electronAPI.extractWordsFromQueries({ limit: 50 });

// 获取词汇统计
const stats = await window.electronAPI.getVocabularyStats();
```

## 注意事项

1. **数据库初始化**：应用启动时会自动创建必要的数据库表
2. **AI API配置**：确保已配置AI API密钥才能生成学习计划
3. **单词提取**：提取单词功能会从 `ai_queries` 表中提取单个单词（不含空格）
4. **复习时间**：系统会自动计算下次复习时间，无需手动设置
5. **数据持久化**：所有数据存储在SQLite数据库中，应用重启后数据不会丢失

## 扩展建议

未来可以添加的功能：
- 单词分组和标签
- 自定义复习计划
- 学习曲线可视化
- 导出学习数据
- 多设备同步
- 单词发音功能
- 例句自动生成
- 学习提醒通知

## 技术限制

- 大模型上下文限制：200K tokens
- 单词提取：目前只支持单个单词（不含空格）
- 学习计划：基于文本格式，结构化解析可能需要优化
- 复习算法：使用SM-2算法，可根据需要调整参数

## 总结

这个学习Agent系统提供了完整的英语学习管理功能，通过数据分析和AI辅助，帮助用户制定和执行个性化的学习计划。间隔重复算法确保单词记忆效果，学习分析功能帮助用户了解自己的学习状况。
