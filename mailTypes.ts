// Mail item types and interfaces for the Letterbox.es application

export interface MailItem {
  id: string;
  customer_email: string;
  sender: string;
  date: string;
  status: string;
  priority: string;
  envelope_preview_url: string;
  subscription_plan: string;
  actions?: Record<string, any>[];
  updates?: Record<string, any>[];  // Admin completion updates with scanned documents
  // Legacy support for existing components
  envelopePreview?: string;
  customerEmail?: string;
  type?: 'letter' | 'parcel';
  tracking_number?: string | null;
}

export interface MailAction {
  id: string;
  type: 'scan' | 'forward' | 'hold' | 'recycle' | 'shred';
  timestamp: string;
  notes?: string;
}

export type SubscriptionPlan = 'receive-only' | 'receive-and-scan' | 'receive-and-forward';

export interface Customer {
  id: string;
  fullName: string;
  email: string;
  address: string;
  mailboxNumber: string;
  phoneNumber: string;
  subscriptionPlan: SubscriptionPlan;
  createdAt: string;
}

// Helper functions
export const getAvailableActions = (subscriptionPlan: SubscriptionPlan): string[] => {
  switch (subscriptionPlan) {
    case 'receive-only':
      return ['hold', 'recycle', 'shred'];
    case 'receive-and-scan':
      return ['scan', 'hold', 'recycle', 'shred'];
    case 'receive-and-forward':
      return ['forward', 'recycle', 'shred'];
    default:
      return [];
  }
};

export const getStatusColor = (status: MailItem['status']): string => {
  switch (status) {
    case 'new':
      return 'bg-yellow-500 text-black';
    case 'read':
      return 'bg-blue-500 text-white';
    case 'pending':
      return 'bg-orange-500 text-white';
    case 'processed':
      return 'bg-green-600 text-white';
    case 'expecting':
      return 'bg-purple-500 text-white';
    default:
      return 'bg-gray-500 text-white';
  }
};

export const isUnread = (status: MailItem['status']): boolean => {
  return status === 'new';
};

export const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};
