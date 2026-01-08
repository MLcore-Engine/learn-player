# 学习Agent系统代码详解和使用指南

## 一、代码架构总览

整个学习Agent系统分为四个层次：

```
┌─────────────────────────────────────┐
│  前端UI层 (React组件)                │
│  - LearningAgent.js                 │
│  - learningAnalyticsService.js      │
│  - studyPlanService.js              │
│  - spacedRepetitionService.js       │
└──────────────┬──────────────────────┘
               │ 通过 window.electronAPI
               ▼
┌─────────────────────────────────────┐
│  Electron IPC通信层 (preload.js)    │
│  - 暴露API到渲染进程                  │
└──────────────┬──────────────────────┘
               │ IPC调用
               ▼
┌─────────────────────────────────────┐
│  主进程处理层 (main.js)             │
│  - IPC处理程序 (ipcMain.handle)     │
│  - 数据库操作                       │
└──────────────┬──────────────────────┘
               │ SQL查询
               ▼
┌─────────────────────────────────────┐
│  数据存储层 (SQLite)                 │
│  - vocabulary (单词表)               │
│  - vocabulary_reviews (复习记录)    │
│  - study_plans (学习计划)           │
└─────────────────────────────────────┘
```

## 二、各部分功能详解

### 1. 数据库层 (main.js)

#### 创建的表结构：

**vocabulary 表** - 存储单词及其学习进度
```sql
CREATE TABLE vocabulary (
  id INTEGER PRIMARY KEY,
  word TEXT NOT NULL UNIQUE,          -- 单词本身
  phonetic TEXT,                      -- 音标
  meaning TEXT,                       -- 中文含义
  example TEXT,                       -- 例句
  explanation TEXT,                   -- AI详细解释
  ease REAL DEFAULT 2.5,             -- SM-2算法的易度因子
  interval INTEGER DEFAULT 0,        -- 复习间隔（天）
  repetitions INTEGER DEFAULT 0,     -- 已复习次数
  next_review TEXT,                  -- 下次复习时间
  last_review TEXT,                  -- 上次复习时间
  created_at TEXT,                   -- 创建时间
  updated_at TEXT                    -- 更新时间
);
```

**vocabulary_reviews 表** - 记录每次复习的详细信息
```sql
CREATE TABLE vocabulary_reviews (
  id INTEGER PRIMARY KEY,
  vocabulary_id INTEGER,             -- 关联的单词ID
  quality INTEGER NOT NULL,         -- 评分 (0-3)
  ease_before REAL,                 -- 复习前的易度因子
  ease_after REAL,                  -- 复习后的易度因子
  interval_before INTEGER,           -- 复习前的间隔
  interval_after INTEGER,            -- 复习后的间隔
  created_at TEXT                   -- 复习时间
);
```

**study_plans 表** - 存储AI生成的学习计划
```sql
CREATE TABLE study_plans (
  id INTEGER PRIMARY KEY,
  plan_data TEXT NOT NULL,          -- 计划文本内容
  structured_plan TEXT,             -- 结构化数据(JSON)
  days INTEGER DEFAULT 7,           -- 计划天数
  status TEXT DEFAULT 'active',      -- 状态: active/completed
  progress INTEGER DEFAULT 0,       -- 完成进度 0-100
  created_at TEXT,
  updated_at TEXT
);
```

### 2. 主进程处理层 (main.js)

#### 主要IPC处理程序：

**学习分析相关：**
- `getLearningOverview` - 获取学习概况（总时长、查询数、学习天数等）
- `analyzeLearningPattern` - 分析学习模式（活跃时段、频率、趋势）
- `getLearningReport` - 获取学习报告（指定天数内的统计）
- `getWordFrequencyStats` - 获取单词频率统计（最常查询的单词）

**学习计划相关：**
- `saveStudyPlan` - 保存学习计划
- `getCurrentStudyPlan` - 获取当前活跃的计划
- `updatePlanProgress` - 更新计划完成进度

**背单词相关：**
- `getWordsToReview` - 获取需要复习的单词（根据next_review时间）
- `getVocabularyCard` - 获取单词卡片数据（用于复习）
- `updateVocabularyCard` - 更新单词卡片（提交复习结果，计算下次复习时间）
- `addVocabularyWord` - 添加新单词到学习列表
- `extractWordsFromQueries` - 从AI查询记录中提取单词
- `getVocabularyStats` - 获取词汇学习统计（总数、待复习、已掌握等）

### 3. 服务层 (services/)

#### learningAnalyticsService.js
封装学习数据分析的API调用：
```javascript
// 获取学习概况
const overview = await learningAnalyticsService.getLearningOverview(electronAPI);
// 返回: { totalTime, totalQueries, activeDays, avgDailyTime, todayQueries }

// 分析学习模式
const pattern = await learningAnalyticsService.analyzeLearningPattern(electronAPI);
// 返回: { mostActiveHour, frequency, recentTrend, recentCount }

// 获取学习报告
const report = await learningAnalyticsService.getLearningReport(electronAPI, { days: 7 });
```

#### studyPlanService.js
负责学习计划的生成和管理：
```javascript
// 生成学习计划（会调用AI生成）
const result = await studyPlanService.generateStudyPlan(electronAPI, {
  days: 7,
  focus: 'vocabulary' // 或 'listening', 'comprehensive'
});
// 返回: { planText: 'AI生成的计划文本', plan: {...结构化数据} }

// 获取当前计划
const plan = await studyPlanService.getCurrentStudyPlan(electronAPI);
```

#### spacedRepetitionService.js
实现SM-2间隔重复算法：
```javascript
// 核心算法：计算下次复习时间
calculateNextReview(card, quality) {
  // quality: 0=重来, 1=困难, 2=良好, 3=简单
  // 根据评分调整易度因子和间隔
  // 返回更新后的卡片数据
}

// 获取需要复习的单词
const words = await spacedRepetitionService.getWordsToReview(electronAPI, 20);

// 提交复习结果
await spacedRepetitionService.submitReview(electronAPI, wordId, quality);
// 系统会自动计算下次复习时间并更新数据库

// 从查询记录提取单词
const count = await spacedRepetitionService.extractWordsFromQueries(electronAPI, 50);
```

### 4. UI组件层 (LearningAgent.js)

包含三个标签页：
1. **学习分析标签页** - 显示学习数据和统计
2. **学习计划标签页** - 生成和查看AI学习计划
3. **背单词标签页** - 间隔重复复习界面

## 三、SM-2算法详解

### 算法原理

SM-2算法根据你的记忆质量（评分）自动调整复习间隔：

1. **易度因子 (Ease Factor)**
   - 初始值：2.5
   - 范围：1.3 ~ 无限大
   - 记忆越好，易度因子越高，复习间隔越长

2. **评分与处理**
   - **0 (重来)**：降低易度因子，重置间隔为1天
   - **1 (困难)**：降低易度因子，间隔设为1天
   - **2 (良好)**：保持或小幅增加易度因子，增加间隔
   - **3 (简单)**：增加易度因子，大幅增加间隔

3. **间隔计算**
   - 第1次复习：间隔1天
   - 第2次复习：间隔6天
   - 第3次及以上：间隔 = 上一次间隔 × 易度因子

### 示例流程

假设你学习单词 "example"：

**第1次复习（初始）**
- 易度因子：2.5
- 间隔：0天（立即复习）
- 你评分：2（良好）
- 结果：间隔变为1天，易度因子保持2.5

**第2次复习（1天后）**
- 易度因子：2.5
- 间隔：1天
- 你评分：2（良好）
- 结果：间隔变为6天，易度因子保持2.5

**第3次复习（6天后）**
- 易度因子：2.5
- 间隔：6天
- 你评分：3（简单）
- 结果：间隔变为 6 × 2.5 = 15天，易度因子增加到2.65

**第4次复习（15天后）**
- 易度因子：2.65
- 间隔：15天
- 你评分：2（良好）
- 结果：间隔变为 15 × 2.65 = 39天

## 四、前端集成和使用

### 1. 在SidePanel中集成LearningAgent

修改 `src/components/SidePanel.js`，添加标签页切换功能：

```jsx
import React, { useState } from 'react';
import { Tabs, Tab, Box } from '@mui/material';
import AIContainer from '../containers/AIContainer';
import LearningAgent from '../components/LearningAgent';
// ... 其他导入

const SidePanel = ({ hasExternalSubtitles }) => {
  const [panelTab, setPanelTab] = useState(0); // 0=AI助手, 1=学习Agent
  
  return (
    <Box sx={{ width: width, /* ... */ }}>
      {/* ... 顶部区域 ... */}
      
      {/* 添加标签页切换 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={panelTab} onChange={(e, v) => setPanelTab(v)}>
          <Tab label="AI助手" />
          <Tab label="学习Agent" />
        </Tabs>
      </Box>
      
      {/* 根据标签页显示不同内容 */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {panelTab === 0 ? (
          <AIContainer />
        ) : (
          <LearningAgent />
        )}
      </Box>
    </Box>
  );
};
```

### 2. 直接使用LearningAgent组件

如果你想要独立的页面：

```jsx
import React from 'react';
import LearningAgent from './components/LearningAgent';

function LearningPage() {
  return (
    <div style={{ width: '100%', height: '100vh', padding: '20px' }}>
      <LearningAgent />
    </div>
  );
}

export default LearningPage;
```

### 3. 背单词功能详细使用流程

#### 步骤1：提取单词到学习列表

当你使用AI查询功能查询单词后，这些单词会保存在 `ai_queries` 表中。
要开始背单词，首先需要将这些单词提取到学习列表：

1. 打开 **学习Agent** 标签页
2. 切换到 **背单词** 标签
3. 点击 **"从查询记录提取单词"** 按钮
4. 系统会自动：
   - 从 `ai_queries` 表中查找单个单词（不含空格）
   - 提取单词、音标、含义等信息
   - 添加到 `vocabulary` 表
   - 设置初始复习时间为当前时间

#### 步骤2：开始复习

1. 系统自动显示需要复习的单词（`next_review <= 当前时间`）
2. 显示单词本身（不显示答案）
3. 点击 **"显示答案"** 按钮查看：
   - 音标
   - 中文含义
   - 例句
   - AI详细解释

#### 步骤3：评分和提交

根据记忆情况选择评分：

- **重来 (0)**：完全不记得这个单词
  - 系统会降低易度因子
  - 重置间隔为1天
  - 下次很快就会复习

- **困难 (1)**：需要提示才能想起
  - 系统会降低易度因子
  - 间隔设为1天
  - 需要更频繁复习

- **良好 (2)**：能正确回忆
  - 系统保持或小幅增加易度因子
  - 根据当前间隔和易度因子计算新间隔
  - 正常进度

- **简单 (3)**：非常熟悉
  - 系统增加易度因子
  - 大幅增加复习间隔
  - 可以很久不复习

#### 步骤4：自动进入下一个单词

提交评分后：
- 如果还有待复习单词，自动显示下一个
- 如果本轮复习完成，提示"本轮复习完成！"
- 可以点击"刷新"查看新的待复习单词

### 4. 学习统计

在背单词标签页顶部显示：
- **总单词数**：学习列表中的单词总数
- **待复习**：`next_review <= 当前时间` 的单词数
- **已掌握**：`repetitions >= 5` 的单词数
- **今日复习**：今天已经复习的次数

### 5. 代码示例：直接调用API

如果需要自定义UI，可以直接调用API：

```javascript
// 获取需要复习的单词
const words = await window.electronAPI.getWordsToReview({ limit: 20 });
console.log(words);
// [
//   {
//     id: 1,
//     word: 'example',
//     phonetic: '/ɪgˈzæmpl/',
//     meaning: '例子',
//     example: 'This is an example.',
//     explanation: 'AI解释内容...',
//     ease: 2.5,
//     interval: 6,
//     repetitions: 2,
//     next_review: '2024-01-01T00:00:00.000Z',
//     ...
//   },
//   ...
// ]

// 提交复习结果
const result = await window.electronAPI.updateVocabularyCard({
  wordId: 1,
  ease: 2.5,
  interval: 6,
  repetitions: 2,
  nextReview: '2024-01-08T00:00:00.000Z',
  lastReview: '2024-01-01T00:00:00.000Z',
  quality: 2  // 0-3
});

// 获取词汇统计
const stats = await window.electronAPI.getVocabularyStats();
console.log(stats);
// {
//   total: 50,          // 总单词数
//   dueCount: 10,      // 待复习数
//   masteredCount: 5,  // 已掌握数
//   recentReviews: 3    // 今日复习数
// }
```

## 五、完整使用示例

### 完整的背单词流程代码示例

```jsx
import React, { useState, useEffect } from 'react';
import { Button, Card, Typography, Box } from '@mui/material';
import spacedRepetitionService from '../services/spacedRepetitionService';

function MyVocabularyPractice() {
  const [words, setWords] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [stats, setStats] = useState(null);

  // 加载需要复习的单词
  const loadWords = async () => {
    if (!window.electronAPI) return;
    const wordsList = await spacedRepetitionService.getWordsToReview(
      window.electronAPI, 
      20
    );
    setWords(wordsList);
    setCurrentIndex(0);
    setShowAnswer(false);
  };

  // 提交复习结果
  const handleReview = async (quality) => {
    if (!window.electronAPI || words.length === 0) return;
    
    const currentWord = words[currentIndex];
    try {
      await spacedRepetitionService.submitReview(
        window.electronAPI, 
        currentWord.id, 
        quality
      );
      
      // 移动到下一个单词
      if (currentIndex < words.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setShowAnswer(false);
      } else {
        // 复习完成，重新加载
        await loadWords();
        alert('本轮复习完成！');
      }
      
      // 更新统计
      const newStats = await spacedRepetitionService.getLearningStats(
        window.electronAPI
      );
      setStats(newStats);
    } catch (error) {
      console.error('提交失败:', error);
    }
  };

  // 初始化加载
  useEffect(() => {
    loadWords();
    spacedRepetitionService.getLearningStats(window.electronAPI)
      .then(setStats);
  }, []);

  const currentWord = words[currentIndex];

  return (
    <Box sx={{ p: 3 }}>
      {/* 统计信息 */}
      {stats && (
        <Box sx={{ mb: 2 }}>
          <Typography>总单词: {stats.total}</Typography>
          <Typography>待复习: {stats.dueCount}</Typography>
          <Typography>已掌握: {stats.masteredCount}</Typography>
        </Box>
      )}

      {/* 单词卡片 */}
      {currentWord ? (
        <Card sx={{ p: 3 }}>
          <Typography variant="h3">{currentWord.word}</Typography>
          
          {showAnswer ? (
            <>
              <Typography variant="h6">{currentWord.phonetic}</Typography>
              <Typography>{currentWord.meaning}</Typography>
              {currentWord.example && (
                <Typography>{currentWord.example}</Typography>
              )}
              
              {/* 评分按钮 */}
              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Button onClick={() => handleReview(0)}>重来</Button>
                <Button onClick={() => handleReview(1)}>困难</Button>
                <Button onClick={() => handleReview(2)}>良好</Button>
                <Button onClick={() => handleReview(3)}>简单</Button>
              </Box>
            </>
          ) : (
            <Button onClick={() => setShowAnswer(true)}>
              显示答案
            </Button>
          )}
        </Card>
      ) : (
        <Typography>没有需要复习的单词</Typography>
      )}
    </Box>
  );
}

export default MyVocabularyPractice;
```

## 六、总结

### 系统工作流程

1. **数据收集**：用户使用AI查询单词 → 保存到 `ai_queries` 表
2. **单词提取**：从查询记录提取单词 → 保存到 `vocabulary` 表
3. **复习安排**：SM-2算法根据记忆质量计算下次复习时间
4. **自动提醒**：系统根据 `next_review` 时间自动显示待复习单词
5. **持续优化**：根据每次复习的评分调整间隔，记忆越牢固，间隔越长

### 关键特性

- ✅ **智能间隔重复**：SM-2算法确保在遗忘前复习
- ✅ **个性化计划**：AI根据学习数据生成学习计划
- ✅ **数据驱动**：基于真实学习数据进行分析
- ✅ **自动化**：无需手动安排复习时间
- ✅ **持久化**：所有数据保存在SQLite数据库

现在你可以在前端页面中集成 `LearningAgent` 组件，开始使用背单词功能了！
