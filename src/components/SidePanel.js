import React, { useState } from 'react';
import { useTimeStats } from '../contexts/AppContext';
import { Box } from '@mui/material';
import SidePanelHeader from './SidePanelHeader';
import SidePanelTabs from './SidePanelTabs';
import SidePanelContent from './SidePanelContent';
import useExplainFlow from '../hooks/useExplainFlow';
import useResizablePanel from '../hooks/useResizablePanel';

/**
 * 侧边面板组件
 * 集成各个子容器组件
 */
const SidePanel = React.memo(({ hasExternalSubtitles }) => {
  const { totalTime, sessionTime, remainingSeconds, formatTime } = useTimeStats();
  const [panelTab, setPanelTab] = useState(0); // 0=AI助手, 1=查看记录, 2=导出PDF
  const { width, isDragging, handleDragStart } = useResizablePanel();
  const {
    explainLoading,
    handleCloseModal,
    handleExplain,
    handleOCRRecognize,
    isVideoLoaded,
    ocrLoading,
    ocrModalOpen,
    ocrResult
  } = useExplainFlow({ hasExternalSubtitles });
  
  const timeStatsProps = {
    totalTime,
    sessionTime,
    remainingSeconds,
    formatTime
  };
  
  // 护眼色主题
  const eyeCareColors = {
    background: '#FDF8E8',      // 主背景 - 淡米黄
    headerBg: '#F8F3E3',        // 头部背景 - 略深
    border: '#E8E0C8',          // 边框色
    dragBar: '#D4C9A8'          // 拖动条色
  };
  
  return (
    <Box sx={{ 
      width: width, 
      borderLeft: `1px solid ${eyeCareColors.border}`, 
      backgroundColor: eyeCareColors.background, 
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
          backgroundColor: isDragging ? eyeCareColors.dragBar : 'transparent',
          transition: 'background-color 0.2s',
          '&:hover': {
            backgroundColor: eyeCareColors.dragBar
          }
        }}
        onMouseDown={handleDragStart}
      />
      <SidePanelHeader
        explainLoading={explainLoading}
        hasExternalSubtitles={hasExternalSubtitles}
        isVideoLoaded={isVideoLoaded}
        ocrLoading={ocrLoading}
        ocrModalOpen={ocrModalOpen}
        ocrResult={ocrResult}
        onCloseModal={handleCloseModal}
        onExplain={handleExplain}
        onRecognize={handleOCRRecognize}
        timeStatsProps={timeStatsProps}
      />
      
      {/* 标签页切换 */}
      <SidePanelTabs panelTab={panelTab} onChange={(event, value) => setPanelTab(value)} />
      
      {/* 根据标签页显示不同内容 */}
      <SidePanelContent panelTab={panelTab} />
    </Box>
  );
});

export default SidePanel; 
