import React from 'react';
import { Box, Tab, Tabs } from '@mui/material';

const SidePanelTabs = ({ panelTab, onChange }) => (
  <Box sx={{
    borderBottom: 1,
    borderColor: 'divider',
    backgroundColor: 'background.paper',
    flexShrink: 0
  }}>
    <Tabs
      value={panelTab}
      onChange={onChange}
      sx={{ minHeight: 'auto' }}
      variant="fullWidth"
    >
      <Tab
        label="AI助手"
        sx={{ fontSize: '0.875rem', py: 1, textTransform: 'none' }}
      />
    </Tabs>
  </Box>
);

export default SidePanelTabs;
