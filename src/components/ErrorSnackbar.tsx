import React from 'react';
import { Snackbar, Alert } from '@mui/material';
import { useError } from '../contexts/AppContext';

const ErrorSnackbar: React.FC = () => {
  const { error, showError, hideError } = useError();

  if (!error) return null;

  return (
    <Snackbar
      open={showError}
      autoHideDuration={6000}
      onClose={hideError}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert
        onClose={hideError}
        severity="error"
        variant="filled"
        sx={{ width: '100%' }}
      >
        {String(error)}
      </Alert>
    </Snackbar>
  );
};

export default ErrorSnackbar;
