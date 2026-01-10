import React from 'react';
import AIContainer from '../containers/AIContainer';
import { Box } from '@mui/material';

const SidePanelContent = ({ panelTab }) => (
  <Box sx={{
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'background.default'
  }}>
    <AIContainer />
  </Box>
);

export default SidePanelContent;
