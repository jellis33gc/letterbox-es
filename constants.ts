// Application constants for Letterbox.es

export const LOGO_URL = "https://static.riff.new/public/72a09fee-63c7-4a83-89a0-c96523f98160/openmail.jpg";

export const COLORS = {
  primary: {
    yellow: '#eab308', // yellow-500
    yellowHover: '#ca8a04', // yellow-600
  },
  secondary: {
    black: '#000000',
    gray: '#6b7280', // gray-500
  }
} as const;

export const ADMIN_EMAIL = 'info@letterbox.es';

export const SUBSCRIPTION_PLANS = {
  RECEIVE_ONLY: 'receive-only',
  RECEIVE_AND_SCAN: 'receive-and-scan',
  RECEIVE_AND_FORWARD: 'receive-and-forward'
} as const;
