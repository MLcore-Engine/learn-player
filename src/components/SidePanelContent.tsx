import React from 'react';
import AIContainer from '../containers/AIContainer';
import ReviewTab from './tabs/ReviewTab';
import StatsTab from './tabs/StatsTab';
import PlanTab from './tabs/PlanTab';
import SummaryTab from './tabs/SummaryTab';
import { Box } from '@mui/material';

export interface SidePanelContentProps {
  panelTab: number;
  onBackToSubtitle: () => void;
}

// Tab 索引约定：0=解释, 1=复习, 2=统计, 3=计划, 4=总结
const renderTab = (panelTab: number, onBackToSubtitle: () => void): React.ReactNode => {
  switch (panelTab) {
    case 0:
      return <AIContainer onBackToSubtitles={onBackToSubtitle} />;
    case 1:
      return <ReviewTab onBackToSubtitle={onBackToSubtitle} />;
    case 2:
      return <StatsTab onBackToSubtitle={onBackToSubtitle} />;
    case 3:
      return <PlanTab onBackToSubtitle={onBackToSubtitle} />;
    case 4:
      return <SummaryTab onBackToSubtitle={onBackToSubtitle} />;
    default:
      return <AIContainer onBackToSubtitles={onBackToSubtitle} />;
  }
};

const SidePanelContent: React.FC<SidePanelContentProps> = ({ panelTab, onBackToSubtitle }) => (
  <Box
    sx={{
      flex: 1,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'background.default'
    }}
  >
    {renderTab(panelTab, onBackToSubtitle)}
  </Box>
);

export default SidePanelContent;
