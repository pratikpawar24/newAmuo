'use client';

import toast, { Toaster, ToastOptions } from 'react-hot-toast';

// Re-export Toaster for easy use
export { Toaster };

// Custom styled toast functions
export const showToast = {
  success: (message: string, options?: ToastOptions) => {
    return toast.success(message, {
      duration: 4000,
      position: 'top-right',
      style: {
        background: '#10b981',
        color: '#fff',
        padding: '12px 16px',
        borderRadius: '8px',
        fontWeight: '500',
      },
      iconTheme: {
        primary: '#fff',
        secondary: '#10b981',
      },
      ...options,
    });
  },

  error: (message: string, options?: ToastOptions) => {
    return toast.error(message, {
      duration: 5000,
      position: 'top-right',
      style: {
        background: '#ef4444',
        color: '#fff',
        padding: '12px 16px',
        borderRadius: '8px',
        fontWeight: '500',
      },
      iconTheme: {
        primary: '#fff',
        secondary: '#ef4444',
      },
      ...options,
    });
  },

  info: (message: string, options?: ToastOptions) => {
    return toast(message, {
      duration: 4000,
      position: 'top-right',
      icon: 'ℹ️',
      style: {
        background: '#3b82f6',
        color: '#fff',
        padding: '12px 16px',
        borderRadius: '8px',
        fontWeight: '500',
      },
      ...options,
    });
  },

  warning: (message: string, options?: ToastOptions) => {
    return toast(message, {
      duration: 4500,
      position: 'top-right',
      icon: '⚠️',
      style: {
        background: '#f59e0b',
        color: '#fff',
        padding: '12px 16px',
        borderRadius: '8px',
        fontWeight: '500',
      },
      ...options,
    });
  },

  loading: (message: string, options?: ToastOptions) => {
    return toast.loading(message, {
      position: 'top-right',
      style: {
        background: '#1e293b',
        color: '#fff',
        padding: '12px 16px',
        borderRadius: '8px',
        fontWeight: '500',
      },
      ...options,
    });
  },

  dismiss: (toastId?: string) => {
    if (toastId) {
      toast.dismiss(toastId);
    } else {
      toast.dismiss();
    }
  },

  promise: <T,>(
    promise: Promise<T>,
    messages: { loading: string; success: string; error: string },
    options?: ToastOptions
  ) => {
    return toast.promise(
      promise,
      {
        loading: messages.loading,
        success: messages.success,
        error: messages.error,
      },
      {
        position: 'top-right',
        style: {
          padding: '12px 16px',
          borderRadius: '8px',
          fontWeight: '500',
        },
        ...options,
      }
    );
  },
};

// Toast component with custom styling
export default function Toast() {
  return (
    <Toaster
      position="top-right"
      reverseOrder={false}
      gutter={8}
      containerClassName=""
      containerStyle={{}}
      toastOptions={{
        // Default options for all toasts
        duration: 4000,
        style: {
          background: '#1e293b',
          color: '#fff',
          padding: '12px 16px',
          borderRadius: '8px',
          fontWeight: '500',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        },
        // Success toast styling
        success: {
          duration: 4000,
          iconTheme: {
            primary: '#10b981',
            secondary: '#fff',
          },
        },
        // Error toast styling
        error: {
          duration: 5000,
          iconTheme: {
            primary: '#ef4444',
            secondary: '#fff',
          },
        },
      }}
    />
  );
}
