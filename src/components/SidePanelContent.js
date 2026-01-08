import React from 'react';
import AIContainer from '../containers/AIContainer';
import LearningAgent from './LearningAgent';
import { Box } from '@mui/material';

const SidePanelContent = ({ panelTab }) => (
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
);

export default SidePanelContent;
