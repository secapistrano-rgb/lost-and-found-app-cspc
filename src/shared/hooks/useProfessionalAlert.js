import { useState } from 'react';

const useProfessionalAlert = () => {
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    buttons: [],
    type: 'info',
  });

  const showAlert = ({
    title,
    message,
    buttons = [{ text: 'OK' }],
    type = 'info'
  }) => {
    setAlertConfig({
      visible: true,
      title,
      message,
      buttons,
      type
    });
  };

  const hideAlert = () => {
    setAlertConfig(prev => ({
      ...prev,
      visible: false
    }));
  };

  // Convenience methods for different alert types
  const showSuccess = (title, message, buttons) => {
    showAlert({ title, message, buttons, type: 'success' });
  };

  const showError = (title, message, buttons) => {
    showAlert({ title, message, buttons, type: 'error' });
  };

  const showWarning = (title, message, buttons) => {
    showAlert({ title, message, buttons, type: 'warning' });
  };

  const showConfirm = (title, message, buttons) => {
    showAlert({ title, message, buttons, type: 'confirm' });
  };

  const showInfo = (title, message, buttons) => {
    showAlert({ title, message, buttons, type: 'info' });
  };

  return {
    alertConfig,
    showAlert,
    hideAlert,
    showSuccess,
    showError,
    showWarning,
    showConfirm,
    showInfo
  };
};

export default useProfessionalAlert;