import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import type { User } from "firebase/auth";
import {
  mailUtils,
  customerUtils,
  notificationUtils,
  firestoreHelpers,
  sampleData,
  type MailItem,
  type Customer,
  type MailAction
} from "utils/firestore";
import { Timestamp } from "firebase/firestore";
import apiClient from "@/apiclient";
import { getEnvelopeUrl } from "@/utils/urlHelper";

export interface UseMailDataResult {
  mailItems: MailItem[];
  customer: Customer | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  processMailAction: (mailId: string, actionType: string, notes?: string, sender?: string) => Promise<void>;
  initializeSampleData: () => Promise<void>;
}

export function useMailData(user: User | null, impersonateEmail?: string | null): UseMailDataResult {
  const [mailItems, setMailItems] = useState<MailItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch customer data by user ID or email
  const fetchCustomer = useCallback(async (user: User): Promise<Customer | null> => {
    try {
      const emailToUse = impersonateEmail || user.email;
      // Use backend API to find customer by email
      if (!emailToUse) {
        return null;
      }
      
      const response = await apiClient.get_customer_by_email({ email: emailToUse });
      const result = await response.json();
      
      if (result.success && result.customer) {
        let locationData = undefined;
        if (result.customer.location_id) {
          try {
            const locResponse = await apiClient.get_location({ locationId: result.customer.location_id });
            locationData = await locResponse.json();
          } catch (e) {
            console.error('Failed to fetch location data', e);
          }
        }

        // Convert backend customer format to frontend format
        return {
          id: result.customer.id,
          userId: result.customer.firebase_uid || user.uid,
          fullName: result.customer.full_name,
          address: result.customer.address,
          mailboxNumber: result.customer.mailbox_number,
          email: result.customer.email,
          telephone: result.customer.telephone,
          locationId: result.customer.location_id,
          location: locationData,
          subscriptionPlan: result.customer.subscription_plan,
          subscriptionStatus: result.customer.subscription_status,
          stripeSubscriptionId: result.customer.stripe_subscription_id,
          stripeCustomerId: result.customer.stripe_customer_id
        } as Customer;
      }
      
      return null;
    } catch (err) {
      console.error('Error fetching customer:', err);
      throw err;
    }
  }, []);

  // Fetch mail items for customer
  const fetchMailItems = useCallback(async (customerEmail: string): Promise<MailItem[]> => {
    try {
      let response;
      if (impersonateEmail) {
        response = await apiClient.get_customer_mail_for_admin({ customerEmail: impersonateEmail });
      } else {
        response = await apiClient.get_customer_mail();
      }
      const result = await response.json();
      
      // Convert backend format to frontend format
      const items = result.mail_items?.map((item: any) => ({
        id: item.id,
        customerId: item.customer_email, // Use email as customerId for consistency
        customerEmail: item.customer_email,
        envelopeImageUrl: getEnvelopeUrl(item.envelope_preview_url),
        dateReceived: Timestamp.fromDate(new Date(item.date)), // Proper Firestore Timestamp
        status: item.status,
        sender: item.sender,
        priority: item.priority,
        actionsTaken: item.actions || [],
        documentUrls: [],
        createdAt: Timestamp.fromDate(new Date(item.created_at || item.date)), // Proper Firestore Timestamp
        updatedAt: Timestamp.fromDate(new Date(item.created_at || item.date)), // Proper Firestore Timestamp
        type: item.type || 'letter',
        tracking_number: item.tracking_number
      })) || [];
      
      return items;
    } catch (err) {
      console.error('Error fetching mail items:', err);
      throw err;
    }
  }, []);

  // Initialize data
  const initializeData = useCallback(async () => {
    if (!user?.email) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Get customer data
      let customerData = await fetchCustomer(user);
      
      // If no customer found for test users, automatically initialize sample data
      if (!customerData && user.email === 'test@letterbox.es') {
        console.log('Test user detected, initializing sample data...');
        try {
          await sampleData.createSampleCustomers(user.uid);
          await sampleData.createSampleMailItems(user.uid);
          // Try to fetch customer data again
          customerData = await fetchCustomer(user);
        } catch (err) {
          console.error('Failed to initialize sample data:', err);
        }
      }
      
      if (!customerData) {
        setError('Customer profile not found. Please contact support.');
        setIsLoading(false);
        return;
      }

      setCustomer(customerData);

      // Get mail items - if none exist, show empty inbox
      try {
        const items = await fetchMailItems(customerData.email);
        setMailItems(items);
      } catch (err) {
        // If customer has no mail data yet, that's normal - show empty inbox
        console.log('No mail data found for customer, showing empty inbox');
        setMailItems([]);
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Error initializing mail data:', err);
      setError('Failed to load mailbox data');
      setIsLoading(false);
    }
  }, [user, fetchCustomer, fetchMailItems]);

  // Refetch data
  const refetch = useCallback(async () => {
    await initializeData();
  }, [initializeData]);

  // Process mail action
  const processMailAction = useCallback(async (mailId: string, actionType: string, notes?: string, sender?: string) => {
    if (!customer) {
      throw new Error('Customer data not available');
    }

    try {
      // Use backend API to process mail action
      const response = await apiClient.process_mail_action({
        mail_id: mailId,
        action: actionType,
        notes: notes || null,
        sender: sender || null
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to process mail action');
      }

      // Update local state optimistically
      setMailItems(prev => prev.map(item => {
        if (item.id === mailId) {
          const updatedItem = {
            ...item,
            status: result.new_status as any,
            actionsTaken: [...(item.actionsTaken || []), {
              id: `action_${Date.now()}`,
              type: actionType as any,
              timestamp: Timestamp.now(),
              status: 'pending',
              notes: notes || undefined
            }]
          };
          
          // If adding tracking, update the tracking number on the item directly
          if (actionType === 'add_tracking') {
            if (notes) updatedItem.tracking_number = notes;
            if (sender) updatedItem.sender = sender;
          }
          
          return updatedItem;
        }
        return item;
      }));

      toast.success(`Mail action "${actionType}" processed successfully`);
    } catch (err) {
      console.error('Error processing mail action:', err);
      toast.error(`Failed to process mail action: ${actionType}`);
      throw err;
    }
  }, [customer]);

  // Initialize sample data
  const initializeSampleData = useCallback(async () => {
    if (!user?.uid) {
      toast.error('User not authenticated');
      return;
    }
    
    try {
      toast.info('Creating sample data...');
      // Use the backend API instead of direct Firestore calls
      const response = await apiClient.create_sample_data({ customer_email: user.email || 'test@letterbox.es' });
      const result = await response.json();
      
      if (result.success) {
        toast.success(`Sample data created successfully: ${result.items_created} items`);
        await refetch();
      } else {
        toast.error('Failed to create sample data');
      }
    } catch (err) {
      console.error('Error creating sample data:', err);
      toast.error('Failed to create sample data');
      throw err;
    }
  }, [refetch, user?.email, user?.uid]);

  // Set up real-time subscription for mail items
  useEffect(() => {
    if (!customer?.email) return;

    console.log('Setting up data fetch for:', customer.email);
    
    // Since we're using backend API, do an initial fetch
    // For real-time updates, we'd need to implement polling or websockets
    const fetchData = async () => {
      try {
        const items = await fetchMailItems(customer.email);
        console.log('Fetched mail items:', items.length, 'items');
        setMailItems(items);
      } catch (err) {
        console.error('Error fetching mail items:', err);
      }
    };
    
    fetchData();
    
    // Set up periodic refresh (every 30 seconds) to simulate real-time
    const interval = setInterval(fetchData, 30000);
    
    return () => {
      console.log('Cleaning up mail fetch interval');
      clearInterval(interval);
    };
  }, [customer?.email, fetchMailItems]);

  // Initialize data when user changes
  useEffect(() => {
    initializeData();
  }, [initializeData]);

  return {
    mailItems,
    customer,
    isLoading,
    error,
    refetch,
    processMailAction,
    initializeSampleData
  };
}
