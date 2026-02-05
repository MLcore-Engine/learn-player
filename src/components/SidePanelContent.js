import React from 'react';
import AIContainer from '../containers/AIContainer';
import HistoryView from './HistoryView';
import ExportPdfView from './ExportPdfView';
import { Box } from '@mui/material';

/**
 * 侧边面板内容组件
 * 根据标签页索引渲染不同的组件
 * 0: AI助手
 * 1: 查看记录
 * 2: 导出PDF
 * 
 * 使用 display 切换而非条件渲染，以保持 AI 助手的对话状态
 */
const SidePanelContent = ({ panelTab }) => {
  return (
    <Box sx={{
      flex: 1,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#FDF8E8'
    }}>
      {/* AI助手 - 始终渲染，通过 display 控制显示 */}
      <Box sx={{ 
        display: panelTab === 0 ? 'flex' : 'none',
        flexDirection: 'column',
        flex: 1,
        overflow: 'hidden'
      }}>
        <AIContainer />
      </Box>
      
      {/* 查看记录 - 始终渲染，通过 display 控制显示 */}
      <Box sx={{ 
        display: panelTab === 1 ? 'flex' : 'none',
        flexDirection: 'column',
        flex: 1,
        overflow: 'hidden'
      }}>
        <HistoryView />
      </Box>
      
      {/* 导出PDF - 始终渲染，通过 display 控制显示 */}
      <Box sx={{ 
        display: panelTab === 2 ? 'flex' : 'none',
        flexDirection: 'column',
        flex: 1,
        overflow: 'hidden'
      }}>
        <ExportPdfView />
      </Box>
    </Box>
  );
};

export default SidePanelContent;
