# 前端集成示例：在SidePanel中使用LearningAgent

## 方案一：添加标签页切换（推荐）

修改 `src/components/SidePanel.js`，在AI助手和学习Agent之间切换：

```jsx
import React, { useState, useCallback, useEffect } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import TimeStats from './TimeStats';
import OCRContainer from '../containers/OCRContainer';
import AIContainer from '../containers/AIContainer';
import LearningAgent from '../components/LearningAgent'; // 导入LearningAgent
import OCRResultModal from '../components/OCRResultModal';
import { useTimeStats, useAI, useVideo } from '../contexts/AppContext';
import aiService from '../utils/aiService';

const SidePanel = React.memo(({ hasExternalSubtitles }) => {
  const { totalTime, sessionTime, remainingSeconds, formatTime } = useTimeStats();
  const [width, setWidth] = useState(360);
  const [isDragging, setIsDragging] = useState(false);
  const [panelTab, setPanelTab] = useState(0); // 0=AI助手, 1=学习Agent
  
  // ... 其他状态和逻辑保持不变 ...
  
  return (
    <Box sx={{ 
      width: width, 
      borderLeft: '1px solid #444', 
      backgroundColor: '#111', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
      height: '100%'
    }}>
      {/* 拖动条 - 保持不变 */}
      <Box sx={{ /* ... */ }} onMouseDown={handleDragStart} />
      
      {/* 顶部区域 - 保持不变 */}
      <Box sx={{ /* ... */ }}>
        {/* OCRContainer 和 TimeStats - 保持不变 */}
      </Box>
      
      {/* 添加标签页切换 */}
      <Box sx={{ 
        borderBottom: 1, 
        borderColor: 'divider',
        backgroundColor: 'background.paper'
      }}>
        <Tabs 
          value={panelTab} 
          onChange={(e, v) => setPanelTab(v)}
          sx={{ minHeight: 'auto' }}
        >
          <Tab label="AI助手" sx={{ fontSize: '0.875rem', py: 1 }} />
          <Tab label="学习Agent" sx={{ fontSize: '0.875rem', py: 1 }} />
        </Tabs>
      </Box>
      
      {/* 根据标签页显示不同内容 */}
      <Box sx={{ 
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'background.default'
      }}>
        {panelTab === 0 ? (
          <AIContainer />
        ) : (
          <LearningAgent />
        )}
      </Box>
    </Box>
  );
});

export default SidePanel;
```

## 方案二：独立页面

如果希望学习Agent有独立的页面，可以在路由中添加：

```jsx
// src/screens/LearningScreen.js
import React from 'react';
import { Box } from '@mui/material';
import LearningAgent from '../components/LearningAgent';

const LearningScreen = () => {
  return (
    <Box sx={{ 
      width: '100%', 
      height: '100vh', 
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Box sx={{ 
        flex: 1, 
        overflow: 'hidden',
        p: 2 
      }}>
        <LearningAgent />
      </Box>
    </Box>
  );
};

export default LearningScreen;
```

## 方案三：在现有组件中添加按钮

在 `LearningAssistant.js` 中添加一个按钮，点击后切换到学习Agent：

```jsx
// 在 LearningAssistant.js 的底部按钮区域添加
<Button
  variant="outlined"
  startIcon={<School />}
  onClick={() => {
    // 通过props传递切换函数
    if (onSwitchToAgent) {
      onSwitchToAgent();
    }
  }}
  size="small"
>
  学习Agent
</Button>
```

## 完整代码示例（方案一）

这是完整的修改后的 `SidePanel.js`：

```jsx
import React, { useState, useCallback, useEffect } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import TimeStats from './TimeStats';
import OCRContainer from '../containers/OCRContainer';
import AIContainer from '../containers/AIContainer';
import LearningAgent from '../components/LearningAgent';
import OCRResultModal from '../components/OCRResultModal';
import { useTimeStats, useAI, useVideo } from '../contexts/AppContext';
import aiService from '../utils/aiService';

const SidePanel = React.memo(({ hasExternalSubtitles }) => {
  const { totalTime, sessionTime, remainingSeconds, formatTime } = useTimeStats();
  const [width, setWidth] = useState(360);
  const [isDragging, setIsDragging] = useState(false);
  const [panelTab, setPanelTab] = useState(0); // 新增：标签页状态
  
  // OCR弹窗相关状态
  const [ocrModalOpen, setOcrModalOpen] = useState(false);
  const [ocrResult, setOcrResult] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);

  // AI解释相关状态
  const [explainLoading, setExplainLoading] = useState(false);
  const { setSelectedText, setExplanation, setLoading: setAiLoading, addRecord } = useAI();

  // 视频加载状态从 context 获取
  const { isLoaded: isVideoLoaded, playerRef } = useVideo();

  // 从localStorage加载保存的宽度
  useEffect(() => {
    const savedWidth = localStorage.getItem('sidePanelWidth');
    if (savedWidth) {
      setWidth(parseInt(savedWidth, 10));
    }
  }, []);

  // 处理拖动开始
  const handleDragStart = useCallback((e) => {
    setIsDragging(true);
    e.preventDefault();
  }, []);

  // 处理拖动
  const handleDrag = useCallback((e) => {
    if (!isDragging) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth >= 200 && newWidth <= 800) {
      setWidth(newWidth);
    }
  }, [isDragging]);

  // 处理拖动结束
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    localStorage.setItem('sidePanelWidth', width.toString());
  }, [width]);

  // 添加和移除全局事件监听
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDrag);
      window.addEventListener('mouseup', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDrag);
      window.removeEventListener('mouseup', handleDragEnd);
    };
  }, [isDragging, handleDrag, handleDragEnd]);
  
  const timeStatsProps = {
    totalTime,
    sessionTime,
    remainingSeconds,
    formatTime
  };
  
  // OCRContainer的回调，识别完成后弹窗
  const handleOCRRecognize = useCallback((recognizedText) => {
    if (hasExternalSubtitles && playerRef.current) {
      try {
        const player = playerRef.current;
        if (player && player.textTracks) {
          const tracks = player.textTracks();
          for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            if (track.label === '外挂字幕' && track.activeCues && track.activeCues.length > 0) {
              const text = track.activeCues[0].text;
              setOcrResult(text);
              setOcrModalOpen(true);
              return;
            }
          }
        }
      } catch (error) {
        console.error('获取字幕轨道失败:', error);
      }
    }

    if (recognizedText === '识别中...') {
      setOcrLoading(true);
      return;
    }
    
    setOcrResult(recognizedText);
    setOcrModalOpen(true);
    setOcrLoading(false);
  }, [hasExternalSubtitles, playerRef]);

  // 解释按钮回调
  const handleExplain = useCallback(async (lang, selectedText) => {
    const text = selectedText || ocrResult;
    if (!text) {
      alert('没有可解释的文字');
      return;
    }
    setExplainLoading(true);
    setAiLoading(true);
    setSelectedText(text);
    try {
      setExplanation('');
      let buffer = '';
      const explanation = await aiService.streamExplanation(text, {
        onDelta: (piece, full) => {
          buffer = full;
          setExplanation(buffer);
        }
      }, { language: lang });
      addRecord({ subtitle_text: text, explanation, timestamp: Date.now() });
      if (window.electronAPI) {
        window.electronAPI.saveAiQuery({
          query: text,
          explanation,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('AI解释失败:', error);
    } finally {
      setAiLoading(false);
      setExplainLoading(false);
      setOcrModalOpen(false);
      setOcrResult('');
    }
  }, [ocrResult, setAiLoading, setSelectedText, setExplanation, addRecord]);

  // 关闭弹窗
  const handleCloseModal = useCallback(() => {
    setOcrModalOpen(false);
    setOcrResult('');
    setExplainLoading(false);
  }, []);

  return (
    <Box sx={{ 
      width: width, 
      borderLeft: '1px solid #444', 
      backgroundColor: '#111', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
      height: '100%'
    }}>
      {/* 拖动条 */}
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '4px',
          cursor: 'col-resize',
          backgroundColor: isDragging ? '#666' : 'transparent',
          transition: 'background-color 0.2s',
          '&:hover': {
            backgroundColor: '#666'
          }
        }}
        onMouseDown={handleDragStart}
      />
      
      {/* 顶部区域 */}
      <Box sx={{
        width: '100%',
        position: 'relative',
        pt: 1.5,
        pb: 0.5,
        px: 2,
        backgroundColor: 'background.paper',
        borderBottom: '1px solid rgba(255,255,255,0.08)'
      }}>
        <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ flex: 1, width: '48%' }}>
            <OCRContainer 
              onRecognize={handleOCRRecognize} 
              isLoading={ocrLoading} 
              videoReady={isVideoLoaded}
              hasExternalSubtitles={hasExternalSubtitles}
            />
          </Box>
          <Box sx={{ flex: 4, display: 'flex', justifyContent: 'flex-end' }}>
            <TimeStats {...timeStatsProps} smallFont horizontal/>
          </Box>
        </Box>
        {/* 绝对定位的模态框 */}
        <Box sx={{ position: 'relative' }}>
          <OCRResultModal
            isOpen={ocrModalOpen}
            result={ocrResult}
            onExplain={handleExplain}
            onClose={handleCloseModal}
            isLoading={explainLoading}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              zIndex: 10
            }}
          />
        </Box>
      </Box>
      
      {/* 标签页切换 */}
      <Box sx={{ 
        borderBottom: 1, 
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        flexShrink: 0
      }}>
        <Tabs 
          value={panelTab} 
          onChange={(e, v) => setPanelTab(v)}
          sx={{ minHeight: 'auto' }}
          variant="fullWidth"
        >
          <Tab 
            label="AI助手" 
            sx={{ fontSize: '0.875rem', py: 1, textTransform: 'none' }} 
          />
          <Tab 
            label="学习Agent" 
            sx={{ fontSize: '0.875rem', py: 1, textTransform: 'none' }} 
          />
        </Tabs>
      </Box>
      
      {/* 根据标签页显示不同内容 */}
      <Box sx={{ 
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'background.default'
      }}>
        {panelTab === 0 ? (
          <AIContainer />
        ) : (
          <LearningAgent />
        )}
      </Box>
    </Box>
  );
});

export default SidePanel;
```

## 使用步骤

1. **导入组件**：在 `SidePanel.js` 顶部导入 `LearningAgent`
2. **添加状态**：添加 `panelTab` 状态来控制当前显示的标签页
3. **添加标签页UI**：在顶部区域下方添加 `Tabs` 组件
4. **条件渲染**：根据 `panelTab` 的值渲染 `AIContainer` 或 `LearningAgent`

现在用户可以通过点击标签页在"AI助手"和"学习Agent"之间切换！

## 背单词功能使用流程

1. **切换到学习Agent标签页**
2. **点击"背单词"标签**（LearningAgent组件内的第三个标签）
3. **提取单词**：点击"从查询记录提取单词"按钮
   - 系统会从你之前使用AI查询的单词中提取
   - 提取的单词会自动添加到学习列表
4. **开始复习**：
   - 系统显示需要复习的单词（不显示答案）
   - 点击"显示答案"查看详细信息
   - 根据记忆情况选择评分（重来/困难/良好/简单）
   - 系统自动计算下次复习时间
5. **持续学习**：系统会根据SM-2算法自动安排复习时间
