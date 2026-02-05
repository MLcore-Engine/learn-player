import React from 'react';
import { Box, Tab, Tabs } from '@mui/material';

const SidePanelTabs = ({ panelTab, onChange }) => (
  <Box sx={{
    borderBottom: '1px solid #E8E0C8',
    backgroundColor: '#F8F3E3',
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
      <Tab
        label="查看记录"
        sx={{ fontSize: '0.875rem', py: 1, textTransform: 'none' }}
      />
      <Tab
        label="导出PDF"
        sx={{ fontSize: '0.875rem', py: 1, textTransform: 'none' }}
      />
    </Tabs>
  </Box>
);

export default SidePanelTabs;
