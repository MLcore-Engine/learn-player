import React, { useState } from 'react';
import { useTimeStats } from '../contexts/AppContext';
import { Box } from '@mui/material';
import SidePanelHeader from './SidePanelHeader';
import SidePanelTabs from './SidePanelTabs';
import SidePanelContent from './SidePanelContent';
import useExplainFlow from '../hooks/useExplainFlow';
import useResizablePanel from '../hooks/useResizablePanel';

export interface SidePanelProps {
  hasExternalSubtitles: boolean;
}

/**
 * 侧边面板组件 —— 集成各个子容器组件
 */
const SidePanel = React.memo<SidePanelProps>(({ hasExternalSubtitles }) => {
  const { totalTime, sessionTime } = useTimeStats();
  const [panelTab, setPanelTab] = useState<number>(0); // 0=解释,...,4=总结
  const { width, isDragging, handleDragStart } = useResizablePanel();
  const {
    explainLoading,
    handleCloseModal,
    handleExplain,
    handleOCRRecognize,
    cancelExplain,
    isVideoLoaded,
    ocrLoading,
    ocrModalOpen,
    ocrResult
  } = useExplainFlow({ hasExternalSubtitles });

  const timeStatsProps = {
    totalTime,
    sessionTime
  };

  return (
    <Box
      sx={{
        width,
        borderLeft: '1px solid #444',
        backgroundColor: '#111',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        height: '100%'
      }}
    >
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

      <SidePanelTabs panelTab={panelTab} onChange={(_event, value) => setPanelTab(value)} />

      <SidePanelContent
        panelTab={panelTab}
        onBackToSubtitle={() => {
          cancelExplain();
          setPanelTab(0);
        }}
      />
    </Box>
  );
});

SidePanel.displayName = 'SidePanel';

export default SidePanel;
