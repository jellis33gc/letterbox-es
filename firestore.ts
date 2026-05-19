import { firestore } from "app";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  type DocumentData,
  type QuerySnapshot,
  type Unsubscribe
} from "firebase/firestore";
import type { User } from "firebase/auth";

// Collection names
export const COLLECTIONS = {
  CUSTOMERS: 'customers',
  MAIL_ITEMS: 'mail_items',
  ADMIN_NOTIFICATIONS: 'admin_notifications'
} as const;

// Type definitions
export interface Customer {
  id?: string;
  userId: string; // Firebase Auth UID
  fullName: string;
  address: string;
  mailboxNumber: string;
  email: string;
  telephone: string;
  locationId?: string;
  location?: any; // The fetched location object
  subscriptionPlan: 'receive-only' | 'receive-and-scan' | 'receive-and-forward';
  subscriptionStatus?: string;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface MailItem {
  id?: string;
  customerId: string; // Reference to customer document ID
  customerEmail: string; // For easy querying
  envelopeImageUrl: string;
  dateReceived: Timestamp;
  status: 'new' | 'pending' | 'processed' | 'expecting';
  priority: 'normal' | 'urgent';
  actionsTaken: MailAction[];
  documentUrls: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  sender: string;
  notes?: string;
  type?: 'letter' | 'parcel';
  tracking_number?: string | null;
}

export interface MailAction {
  id: string;
  type: 'hold' | 'recycle' | 'shred' | 'scan' | 'forward';
  timestamp: Timestamp;
  status: 'pending' | 'completed' | 'failed';
  notes?: string;
  processedBy?: string; // Admin user who processed
}

export interface AdminNotification {
  id?: string;
  type: 'mail_action' | 'new_mail' | 'customer_inquiry';
  title: string;
  message: string;
  customerId: string;
  mailItemId?: string;
  isRead: boolean;
  createdAt: Timestamp;
  actionRequired: boolean;
}

// Customer utility functions
export const customerUtils = {
  // Create a new customer
  async create(customerData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = Timestamp.now();
    const docRef = await addDoc(collection(firestore, COLLECTIONS.CUSTOMERS), {
      ...customerData,
      createdAt: now,
      updatedAt: now
    });
    return docRef.id;
  },

  // Get customer by user ID (Firebase Auth UID)
  async getByUserId(userId: string): Promise<Customer | null> {
    const q = query(
      collection(firestore, COLLECTIONS.CUSTOMERS),
      where('userId', '==', userId),
      limit(1)
    );
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Customer;
  },

  // Get customer by email
  async getByEmail(email: string): Promise<Customer | null> {
    const q = query(
      collection(firestore, COLLECTIONS.CUSTOMERS),
      where('email', '==', email),
      limit(1)
    );
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Customer;
  },

  // Update customer
  async update(customerId: string, updates: Partial<Customer>): Promise<void> {
    const customerRef = doc(firestore, COLLECTIONS.CUSTOMERS, customerId);
    await updateDoc(customerRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });
  },

  // Get all customers (admin only)
  async getAll(): Promise<Customer[]> {
    const querySnapshot = await getDocs(
      query(collection(firestore, COLLECTIONS.CUSTOMERS), orderBy('createdAt', 'desc'))
    );
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Customer[];
  }
};

// Mail item utility functions
export const mailUtils = {
  // Create a new mail item
  async create(mailData: Omit<MailItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = Timestamp.now();
    const docRef = await addDoc(collection(firestore, COLLECTIONS.MAIL_ITEMS), {
      ...mailData,
      createdAt: now,
      updatedAt: now
    });
    return docRef.id;
  },

  // Get mail items for a customer
  async getByCustomerEmail(customerEmail: string): Promise<MailItem[]> {
    const q = query(
      collection(firestore, COLLECTIONS.MAIL_ITEMS),
      where('customerEmail', '==', customerEmail)
    );
    const querySnapshot = await getDocs(q);
    
    const items = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as MailItem[];
    
    // Sort by dateReceived in descending order (newest first)
    return items.sort((a, b) => b.dateReceived.toMillis() - a.dateReceived.toMillis());
  },

  // Get mail item by ID
  async getById(mailId: string): Promise<MailItem | null> {
    const docRef = doc(firestore, COLLECTIONS.MAIL_ITEMS, mailId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    return { id: docSnap.id, ...docSnap.data() } as MailItem;
  },

  // Update mail item
  async update(mailId: string, updates: Partial<MailItem>): Promise<void> {
    const mailRef = doc(firestore, COLLECTIONS.MAIL_ITEMS, mailId);
    await updateDoc(mailRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });
  },

  // Add action to mail item
  async addAction(mailId: string, action: Omit<MailAction, 'id'>): Promise<void> {
    const mailItem = await this.getById(mailId);
    if (!mailItem) {
      throw new Error('Mail item not found');
    }

    const newAction: MailAction = {
      ...action,
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    const updatedActions = [...(mailItem.actionsTaken || []), newAction];
    await this.update(mailId, { actionsTaken: updatedActions });
  },

  // Subscribe to customer's mail items (real-time)
  subscribeToCustomerMail(customerEmail: string, callback: (mailItems: MailItem[]) => void): Unsubscribe {
    const q = query(
      collection(firestore, COLLECTIONS.MAIL_ITEMS),
      where('customerEmail', '==', customerEmail)
    );
    
    return onSnapshot(q, (querySnapshot) => {
      const mailItems = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MailItem[];
      
      // Sort by dateReceived in descending order (newest first)
      const sortedItems = mailItems.sort((a, b) => b.dateReceived.toMillis() - a.dateReceived.toMillis());
      callback(sortedItems);
    });
  },

  // Get all mail items (admin only)
  async getAll(): Promise<MailItem[]> {
    const querySnapshot = await getDocs(
      query(collection(firestore, COLLECTIONS.MAIL_ITEMS), orderBy('dateReceived', 'desc'))
    );
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as MailItem[];
  }
};

// Admin notification utility functions
export const notificationUtils = {
  // Create a new notification
  async create(notificationData: Omit<AdminNotification, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(collection(firestore, COLLECTIONS.ADMIN_NOTIFICATIONS), {
      ...notificationData,
      createdAt: Timestamp.now()
    });
    return docRef.id;
  },

  // Get all notifications
  async getAll(): Promise<AdminNotification[]> {
    const querySnapshot = await getDocs(
      query(collection(firestore, COLLECTIONS.ADMIN_NOTIFICATIONS), orderBy('createdAt', 'desc'))
    );
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as AdminNotification[];
  },

  // Mark notification as read
  async markAsRead(notificationId: string): Promise<void> {
    const notificationRef = doc(firestore, COLLECTIONS.ADMIN_NOTIFICATIONS, notificationId);
    await updateDoc(notificationRef, { isRead: true });
  },

  // Subscribe to notifications (real-time)
  subscribeToNotifications(callback: (notifications: AdminNotification[]) => void): Unsubscribe {
    const q = query(
      collection(firestore, COLLECTIONS.ADMIN_NOTIFICATIONS),
      orderBy('createdAt', 'desc')
    );
    
    return onSnapshot(q, (querySnapshot) => {
      const notifications = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AdminNotification[];
      callback(notifications);
    });
  }
};

// Helper functions
export const firestoreHelpers = {
  // Convert Firestore Timestamp to Date
  timestampToDate(timestamp: Timestamp): Date {
    return timestamp.toDate();
  },

  // Convert Date to Firestore Timestamp
  dateToTimestamp(date: Date): Timestamp {
    return Timestamp.fromDate(date);
  },

  // Format date for display
  formatDate(timestamp: Timestamp): string {
    return timestamp.toDate().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
};

// Sample data creation functions
export const sampleData = {
  // Create sample customers
  async createSampleCustomers(userId?: string): Promise<void> {
    const sampleCustomers: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        userId: userId || 'test-user-id',
        fullName: 'John Smith',
        address: '123 Main Street, London, SW1A 1AA',
        mailboxNumber: 'MB001',
        email: 'test@letterbox.es',
        telephone: '+44 20 1234 5678',
        subscriptionPlan: 'receive-and-scan'
      },
      {
        userId: 'test-user-2',
        fullName: 'Sarah Johnson',
        address: '456 Oak Avenue, Manchester, M1 1AA',
        mailboxNumber: 'MB002',
        email: 'sarah@letterbox.es',
        telephone: '+44 161 234 5678',
        subscriptionPlan: 'receive-and-forward'
      },
      {
        userId: 'test-user-3',
        fullName: 'Michael Brown',
        address: '789 High Street, Birmingham, B1 1AA',
        mailboxNumber: 'MB003',
        email: 'michael@letterbox.es',
        telephone: '+44 121 234 5678',
        subscriptionPlan: 'receive-only'
      }
    ];

    for (const customer of sampleCustomers) {
      await customerUtils.create(customer);
    }
  },

  // Create sample mail items
  async createSampleMailItems(userId?: string): Promise<void> {
    const customers = await customerUtils.getAll();
    if (customers.length === 0) {
      await this.createSampleCustomers(userId);
      return this.createSampleMailItems(userId);
    }

    const sampleMailItems: Omit<MailItem, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        customerId: customers[0].id!,
        customerEmail: customers[0].email,
        envelopeImageUrl: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=800&h=600&fit=crop',
        dateReceived: Timestamp.fromDate(new Date(Date.now() - 86400000)), // 1 day ago
        status: 'new',
        sender: 'HMRC',
        priority: 'urgent',
        actionsTaken: [],
        documentUrls: []
      },
      {
        customerId: customers[0].id!,
        customerEmail: customers[0].email,
        envelopeImageUrl: 'https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=800&h=600&fit=crop',
        dateReceived: Timestamp.fromDate(new Date(Date.now() - 172800000)), // 2 days ago
        status: 'processed',
        sender: 'Barclays Bank',
        priority: 'normal',
        actionsTaken: [{
          id: 'action_1',
          type: 'scan',
          timestamp: Timestamp.fromDate(new Date(Date.now() - 86400000)),
          status: 'completed',
          notes: 'Document scanned and emailed to customer'
        }],
        documentUrls: ['https://example.com/scan_123.pdf']
      },
      {
        customerId: customers[0].id!,
        customerEmail: customers[0].email,
        envelopeImageUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&h=600&fit=crop',
        dateReceived: Timestamp.fromDate(new Date(Date.now() - 259200000)), // 3 days ago
        status: 'pending',
        sender: 'NHS',
        priority: 'normal',
        actionsTaken: [{
          id: 'action_2',
          type: 'hold',
          timestamp: Timestamp.fromDate(new Date(Date.now() - 172800000)),
          status: 'completed',
          notes: 'Held for customer collection'
        }],
        documentUrls: []
      }
    ];

    for (const mailItem of sampleMailItems) {
      await mailUtils.create(mailItem);
    }
  }
};
