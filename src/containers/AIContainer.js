import React, { useCallback, useEffect, useRef } from 'react';
import LearningAssistant from '../components/LearningAssistant';
import { useAI, useVideo } from '../contexts/AppContext';
import { useElectronIPC } from '../hooks/useElectronIPC';
import aiService from '../services/aiService';
import { ipcClient } from '../services/ipcClient';

/**
 * AI容器组件
 * 管理AI学习助手相关的状态和逻辑，渲染LearningAssistant组件
 */
const AIContainer = React.memo(({ onBackToSubtitles }) => {
  const { videoPath, playerRef } = useVideo();
  const { 
    selectedText, 
    explanation, 
    loading, 
    setSelectedText,
    setExplanation,
    setLoading,
    addRecord,
    clearRecords
  } = useAI();
  
  const { getLearningRecords } = useElectronIPC();
  
  // 使用ref存储最新的属性和方法，避免useEffect依赖过多导致的循环
  const stableRef = useRef({
    videoPath,
    addRecord,
    clearRecords,
    getLearningRecords
  });
  
  // 更新ref中的值
  useEffect(() => {
    stableRef.current = {
      videoPath,
      addRecord,
      clearRecords,
      getLearningRecords
    };
  }, [videoPath, addRecord, clearRecords, getLearningRecords]);

  // 处理查询解释请求（流式）
  const handleQueryExplanation = useCallback(async (text) => {
    if (!text.trim()) return;
    
    setSelectedText(text);
    setLoading(true);
    setExplanation('');
    
    try {
      let buffer = '';
      const currentTime = playerRef.current?.currentTime?.() || null;
      const result = await aiService.streamExplanation(text, {
        onDelta: (piece, full) => {
          buffer = full; // full 已累加好
          setExplanation(buffer);
        }
      }, {
        videoPath,
        currentTime
      });

      // 保存查询记录到数据库
      if (ipcClient.isAvailable()) {
        await ipcClient.saveAiQuery({
          query: text,
          explanation: result,
          timestamp: new Date().toISOString()
        });
      }
      
      return result;
    } catch (error) {
      console.error('AI解释失败:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [setSelectedText, setExplanation, setLoading, videoPath, playerRef]);

  // 标记是否已加载记录，避免重复请求
  const loadedPathRef = useRef(null);

  // 当视频路径改变时，从数据库加载相关的学习记录
  useEffect(() => {
    const currentVideoPath = videoPath;
    
    // 如果没有视频路径或与上次加载的路径相同，则跳过
    if (!currentVideoPath || currentVideoPath === loadedPathRef.current) return;
    
    // 标记当前路径已开始加载
    loadedPathRef.current = currentVideoPath;
    
    let isMounted = true;
    
    const loadRecords = async () => {
      try {
        if (!isMounted) return;
        
        // 使用ref中保存的方法，确保引用稳定
        stableRef.current.clearRecords();
        
        // 获取与当前视频相关的学习记录
        console.log(`开始加载视频 ${currentVideoPath} 的学习记录`);
        const records = await stableRef.current.getLearningRecords(currentVideoPath);
        
        // 防止组件卸载后设置状态
        if (!isMounted) return;
        
        // 将获取的记录添加到状态
        if (records && records.length > 0) {
          console.log(`成功加载 ${records.length} 条记录`);
          records.forEach(record => {
            if (isMounted) {
              stableRef.current.addRecord({
                subtitle_text: record.content,
                explanation: record.translation || record.explanation,
                timestamp: new Date(record.created_at).getTime()
              });
            }
          });
        } else {
          console.log('没有找到学习记录');
        }
      } catch (error) {
        console.error('加载学习记录失败:', error);
      }
    };
    
    loadRecords();
    
    return () => {
      isMounted = false;
    };
  }, [videoPath]); // 只依赖videoPath

  // 将组件属性组织为一个对象
  const assistantProps = {
    selectedText,
    explanation,
    isLoading: loading,
    onQueryExplanation: handleQueryExplanation,
    onBackToSubtitles
  };

  return (
    <LearningAssistant {...assistantProps} />
  );
});

export default AIContainer; 
