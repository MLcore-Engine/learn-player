import React from 'react';
import AIContainer from '../containers/AIContainer';
import LearningAgent from './LearningAgent';
import { Box } from '@mui/material';

const SidePanelContent = ({ panelTab, onBackToSubtitle }) => (
  <Box sx={{
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'background.default'
  }}>
    {panelTab === 0 ? (
      <AIContainer onBackToSubtitles={onBackToSubtitle} />
    ) : (
      <LearningAgent onBackToSubtitle={onBackToSubtitle} />
    )}
  </Box>
);

export default SidePanelContent;
