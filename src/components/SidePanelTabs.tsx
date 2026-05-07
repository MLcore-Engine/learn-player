import React from 'react';
import { Box, Tab, Tabs } from '@mui/material';

// Tab 索引约定：0=解释, 1=复习, 2=统计, 3=计划, 4=总结
const TABS = ['解释', '复习', '统计', '计划', '总结'] as const;

export interface SidePanelTabsProps {
  panelTab: number;
  onChange: (event: React.SyntheticEvent, value: number) => void;
}

const SidePanelTabs: React.FC<SidePanelTabsProps> = ({ panelTab, onChange }) => (
  <Box
    sx={{
      borderBottom: 1,
      borderColor: 'divider',
      backgroundColor: 'background.paper',
      flexShrink: 0
    }}
  >
    <Tabs
      value={panelTab}
      onChange={onChange}
      sx={{ minHeight: 'auto' }}
      variant="fullWidth"
    >
      {TABS.map((label) => (
        <Tab
          key={label}
          label={label}
          sx={{ fontSize: '0.8rem', py: 1, minWidth: 0, px: 0.5, textTransform: 'none' }}
        />
      ))}
    </Tabs>
  </Box>
);

export default SidePanelTabs;
