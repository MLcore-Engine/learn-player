# 学习助手使用指南（Learning Agent）

> 本文档描述当前代码库（TypeScript 重构后）的真实实现。历史上曾存在的
> `vocabulary` / `vocabulary_reviews` / `ai_queries` / `query_history` 四张表已在
> S1 数据层统一时**废弃并移除**，所有学习数据现在都集中在 `highlights` 一张表里。

## 概述

学习助手由侧边栏的 6 个 Tab 组成：

| # | Tab | 组件 | 作用 |
|---|---|---|---|
| 0 | 解释 | `containers/AIContainer.tsx` → `components/LearningAssistant.tsx` | AI 讲解、追问、流式输出 |
| 1 | 复习 | `components/tabs/ReviewTab.tsx` + `HighlightCard.tsx` | SM-2 间隔重复翻卡复习 |
| 2 | 统计 | `components/tabs/StatsTab.tsx` | 学习时长 / 查询量 / 掌握度图表 |
| 3 | 计划 | `components/tabs/PlanTab.tsx` | AI / 模板两种方式生成学习计划 |
| 4 | 总结 | `components/tabs/SummaryTab.tsx` | 按天导出学习摘要 PDF |
| 5 | 故事 | `components/tabs/StoryTab.tsx` | 生词驱动故事生成 + TTS 配音 |

核心学习闭环：

```
看视频 → 点字幕/选句 → AI 讲解 → 自动入库(highlights) → SM-2 复习 → 统计/计划/总结
                                                    ↘ 生词变故事 + 配音
```

## 数据库表结构

### highlights（唯一学习数据源）

每一次 AI 讲解都会 UPSERT 一行；重复查询同一 `(video_path, original_text)` 只会把
`query_count + 1`，不会产生重复行。

| 字段 | 说明 |
|---|---|
| `id` | 主键（TEXT） |
| `video_path` / `video_title` | 来源视频 |
| `start_time` / `end_time` | 字幕时间轴，可跳回原片位置 |
| `original_text` | 摘取的单词或句子 |
| `context_before` / `context_after` | 上下文 |
| `explanation` | AI 讲解内容 |
| `user_note` | 用户备注 |
| `language` | `zh` / `en` |
| `status` | `learning` / `reviewed` / `mastered` / `archived` |
| `ease` / `interval` / `repetitions` | SM-2 状态 |
| `next_review` / `last_review` | 复习调度 |
| `query_count` / `last_queried_at` | 查询频次（识别高频生词） |
| `UNIQUE(video_path, original_text)` | 去重约束 |

### study_plans（学习计划）

| 字段 | 说明 |
|---|---|
| `plan_data` | Markdown 计划正文（`**加粗**` 由前端渲染） |
| `structured_plan` | JSON：`{days, focus, stats, source, model, weeklyGoal, dailyFocus[], recommendations[], dueCount, recentWords[]}` |
| `days` / `status` / `progress` | 计划天数 / `active\|completed` / 完成进度 |

### stories（故事与配音）

| 字段 | 说明 |
|---|---|
| `body_en` / `body_zh` | 英文正文（目标词加粗）/ 中文翻译 |
| `vocab_words` | 使用的生词（JSON 数组） |
| `style` / `difficulty` / `model` / `chat_model` | 故事风格 / CEFR 难度 / TTS 模型 / 对话模型 |
| `voice` / `audio_path` / `audio_size` | 音色 / 生成的 MP3 路径 / 大小 |

## 服务层（`src/services/`，全部 TypeScript）

| 模块 | 职责 |
|---|---|
| `ipcClient.ts` | 所有 IPC 调用的唯一入口，通道名集中在 `IPC_CHANNELS` |
| `aiService.ts` | 提示词组装（KK 音标 + few-shot）、流式讲解、词汇故事 |
| `aiConfigService.ts` | 配置解析：env → electron-store → 默认值 |
| `highlightService.ts` | highlights 的增删改查 |
| `studyPlanService.ts` | 学习计划生成（AI + 模板回退） |
| `storyService.ts` | 故事文本生成、TTS、历史记录、下载 |

> 组件**不直接**调 `window.electronAPI`，一律走 `ipcClient`，这样类型由
> `src/types/ipc.ts` 的 `ElectronAPI` 接口统一约束。

## 学习计划生成

`studyPlanService.generateStudyPlan({ days, focus, source })`：

1. **采集上下文**：`getHighlightsStats()` + `getDueHighlights()` + `getTodayHighlights()`
2. **AI 模式**（默认）：把学习数据交给 `step-2-mini`，要求只返回 JSON
   `{weekly_goal, daily_focus[], recommendations[], encouragement}`，再渲染成 Markdown
3. **模板模式**：不调用 AI，本地按统计数字拼装基础计划
4. **自动回退**：AI 模式下未配 Key / 网络失败 / 返回非法 JSON / 返回为空，
   都会回退到模板计划，并通过 `fallbackReason` 告知前端（UI 上显示警告条）

## SM-2 间隔重复

- 调度与写入都在**主进程** `main/ipc/index.js` 的 `submitReview` handler 中完成，
  直接更新 `highlights` 行的 SRS 列。
- 评分等级：`0` 重来 / `1` 困难 / `2` 良好 / `3` 简单
- 初始 `ease = 2.5`，下限 `1.3`
- 第 1 次复习间隔 1 天，第 2 次 6 天，第 3 次起 `interval * ease`
- 前端翻卡 UI：`HighlightCard.tsx`（正反面）+ `ReviewTab.tsx`（驱动与队列）

## 故事与配音（Story + TTS）

1. 在「故事」Tab 勾选 / 随机抽取生词，选择风格（短故事 / 对话 / 场景）、CEFR 难度、篇幅
2. `storyService.generateStoryText()` 用 JSON 模式流式生成 `{title, body_en, body_zh}`，
   目标词在 `body_en` 中以 `**` 包裹以便高亮
3. `generateAudio()` 调 `generateTTS`：StepFun 限制单次 1000 字符，主进程会按句子边界
   切分（≤900 字符/请求）再把多段 MP3 拼接成一个文件
4. TTS 模型：`stepaudio-2.5-tts`（默认，支持 instruction 控口音）/ `step-tts-2` / `step-tts-mini`
5. 结果写入 `stories` 表，可试听、下载 MP3 / Markdown、点击历史恢复、删除

## 测试

```bash
CI=true npm test -- --watchAll=false                        # 全部
CI=true npm test -- --watchAll=false --testPathPattern=studyPlanService
```

`src/services/studyPlanService.test.ts` 覆盖：模板模式不调 AI、AI 模式正常解析、
markdown 围栏容错、无 Key / 非法 JSON / 空响应 / 主进程失败四类回退、`days` 边界钳制、
`daily_focus` 截断、上下文采集失败时的降级。

## 注意事项

1. **API Key 必填**：AI 讲解、故事、TTS 都走 StepFun；未配置时计划类功能自动降级为模板，不报错中断
2. **密钥安全**：Key 以 AES-256-CBC 加密存于 electron-store，不要提交 `src/.env`
3. **新增 IPC 通道**要同步改 4 处：`main/ipc/index.js`、`preload.js`、
   `src/services/ipcClient.ts`、`src/types/ipc.ts`
4. **主进程仍是 JS**，渲染进程是全 TS strict；跨进程类型契约以 `src/types/ipc.ts` 为准

## 后续可扩展

- 学习曲线可视化（目前统计Tab仅柱状图）
- 自定义复习计划 / 每日目标持久化
- 导出学习数据（CSV / JSON）
- 单词发音（单独播放单词而非整篇故事）
- 学习提醒通知
- Windows / macOS 代码签名（消除首次安装的安全拦截提示）
