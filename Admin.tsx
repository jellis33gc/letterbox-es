import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { mode, Mode } from "app";
import apiClient from "@/apiclient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Bell, Mail, Plus, UserPlus, Users, Edit, Eye, Key, Trash2, Check, 
  ChevronsUpDown, History, FileText, Filter, X, RefreshCw, MoreHorizontal, Truck, AlertTriangle, MapPin
} from "lucide-react";
import { LOGO_URL } from "utils/constants";
import CustomerDetails from "components/CustomerDetails";
import AdminLocations from "@/components/AdminLocations";
import type { CreateMailItemRequest, Customer, CreateCustomerRequest } from "types";
import { AdminGuard } from "@/components/AdminGuard";
import { cn } from "@/utils/cn";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getEnvelopeUrl } from "@/utils/urlHelper";

interface AdminNotification {
  id: string;
  timestamp: string;
  type: string;
  customer_email: string;
  mail_id?: string;
  sender?: string;
  details: {
    action: string;
    notes?: string;
    [key: string]: any;
  };
  status?: string;
  read?: boolean;
}

interface ActivityLogEntry {
  id: string;
  timestamp: string;
  customer_email: string;
  customer_name?: string;
  action_type: string;
  performed_by: string;
  details: string;
  mail_id: string;
  mail_sender: string;
}

interface MailItemAudit {
  id: string;
  customer_email: string;
  customer_name?: string;
  sender: string;
  date: string;
  status: string;
  priority: string;
  envelope_preview_url: string;
  subscription_plan: string;
  created_at?: string;
  type?: string;
  tracking_number?: string;
  actions?: any[];
  updates?: any[];
}

interface ActionableNotification extends AdminNotification {
  customer_name?: string;
  subscription_plan?: string;
  envelope_preview_url?: string;
  tracking_number?: string;
  sender?: string;
}

interface CustomerFormData {
  full_name: string;
  address: string;
  mailbox_number: string;
  email: string;
  telephone: string;
  location_id?: string;
  subscription_plan: string;
  status?: string;
}

interface LocationData {
  id: string;
  name: string;
}

export default function Admin() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [selectedNotification, setSelectedNotification] = useState<ActionableNotification | null>(null);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionResponse, setActionResponse] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [actionFile, setActionFile] = useState<File | null>(null);
  const [uploadingActionFile, setUploadingActionFile] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isCreatingMail, setIsCreatingMail] = useState(false);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'customers' | 'audit' | 'locations'>('dashboard');
  const [mailForm, setMailForm] = useState({
    customer_email: '',
    sender: '',
    priority: 'normal',
    subscription_plan: 'receive-only'
  });
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [openCustomerSearch, setOpenCustomerSearch] = useState(false);
  const [locations, setLocations] = useState<LocationData[]>([]);
  
  // Audit Log State
  const [auditLogs, setAuditLogs] = useState<ActivityLogEntry[]>([]);
  const [filteredAuditLogs, setFilteredAuditLogs] = useState<ActivityLogEntry[]>([]);
  
  // Mail Audit State
  const [mailAuditItems, setMailAuditItems] = useState<MailItemAudit[]>([]);
  const [filteredMailAuditItems, setFilteredMailAuditItems] = useState<MailItemAudit[]>([]);
  const [selectedMailAuditItem, setSelectedMailAuditItem] = useState<MailItemAudit | null>(null);
  const [showAuditDetailDialog, setShowAuditDetailDialog] = useState(false);

  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [auditFilters, setAuditFilters] = useState({
    customer_email: '',
    status: 'all',
    date_from: '',
    date_to: ''
  });
  const [openAuditCustomerSearch, setOpenAuditCustomerSearch] = useState(false);

  const [customerForm, setCustomerForm] = useState<CustomerFormData>({
    full_name: '',
    address: '',
    mailbox_number: '',
    email: '',
    telephone: '',
    location_id: '',
    subscription_plan: 'receive-and-scan',
    status: 'active'
  });
  const [updatingCustomers, setUpdatingCustomers] = useState<Set<string>>(new Set());
  const [resendingLoginDetails, setResendingLoginDetails] = useState<Set<string>>(new Set());
  const [isSyncingStripe, setIsSyncingStripe] = useState(false);

  // Parcel Management State
  const [selectedParcelItem, setSelectedParcelItem] = useState<MailItemAudit | null>(null);
  const [parcelStatus, setParcelStatus] = useState<string>('');
  const [showUpdateStatusDialog, setShowUpdateStatusDialog] = useState(false);
  const [showEditDetailsDialog, setShowEditDetailsDialog] = useState(false);
  const [parcelDetails, setParcelDetails] = useState({ tracking_number: '', sender: '' });
  const [showSendReminderDialog, setShowSendReminderDialog] = useState(false);
  const [isUpdatingParcel, setIsUpdatingParcel] = useState(false);

  // Mail Item Deletion State
  const [showDeleteMailDialog, setShowDeleteMailDialog] = useState(false);
  const [mailItemToDelete, setMailItemToDelete] = useState<MailItemAudit | null>(null);
  const [isDeletingMailItem, setIsDeletingMailItem] = useState(false);

  // State for editing parcel details in notification dialog
  const [notificationParcelDetails, setNotificationParcelDetails] = useState<{
    tracking_number: string;
    sender: string;
  }>({ tracking_number: '', sender: '' });

  const formatDateTime = (timestamp: string) => {
    if (!timestamp) return "Unknown Date";
    try {
      // Handle timestamp that might be naive (missing timezone info)
      // We assume server timestamps are UTC if not specified
      const dateStr = timestamp.endsWith('Z') || timestamp.includes('+') 
        ? timestamp 
        : timestamp + 'Z';
      
      const date = new Date(dateStr);
      
      if (isNaN(date.getTime())) {
        // Fallback to original string if Z appending made it invalid (unlikely)
        const date2 = new Date(timestamp);
        if (isNaN(date2.getTime())) return "Invalid Date";
        return date2.toLocaleString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });
      }
      
      return date.toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (e) {
      console.error("Date formatting error:", e);
      return "Date Error";
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await apiClient.get_admin_notifications();
      const data = await response.json();
      setNotifications(data.notifications || []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      toast.error('Failed to load notifications');
    }
  }

  const handleNotificationClick = async (notification: AdminNotification) => {
    try {
      // Mark as read immediately
      if (!notification.read) {
        try {
          await apiClient.mark_admin_notification_as_read({ notification_id: notification.id });
          // Update local state to reflect read status
          setNotifications(prev => prev.map(n => 
            n.id === notification.id ? { ...n, read: true } : n
          ));
        } catch (error) {
          console.error('Failed to mark notification as read:', error);
          // Continue execution even if marking as read fails
        }
      }

      // Create actionable notification with customer context and correct envelope URL
      const customerResponse = await apiClient.get_customer_by_email({ email: notification.customer_email });
      const customerData = await customerResponse.json();
      
      let mailItemData = { mail_item: null as any };
      if (notification.mail_id) {
        try {
          const mailItemResponse = await apiClient.get_mail_item_details({
            customerEmail: notification.customer_email,
            mailId: notification.mail_id
          });
          mailItemData = await mailItemResponse.json();
        } catch (error) {
          console.warn('Failed to fetch mail item details, continuing with partial data:', error);
        }
      }
      
      // Initialize parcel details for editing if it's a parcel booking
      // Use fetched mail item data for most up-to-date info
      if (notification.type === 'parcel_booking') {
        setNotificationParcelDetails({
          tracking_number: mailItemData.mail_item?.tracking_number || notification.tracking_number || notification.details?.tracking_number || '',
          sender: mailItemData.mail_item?.sender || notification.sender || notification.details?.sender || ''
        });
      }

      const actionableNotification: ActionableNotification = {
        ...notification,
        customer_name: customerData.customer?.full_name,
        subscription_plan: customerData.customer?.subscription_plan,
        envelope_preview_url: mailItemData.mail_item?.envelope_file_key 
          ? getEnvelopeUrl(mailItemData.mail_item.envelope_file_key)
          : undefined,
        tracking_number: mailItemData.mail_item?.tracking_number,
        sender: mailItemData.mail_item?.sender || notification.sender
      };
      
      setSelectedNotification(actionableNotification);
      setShowActionDialog(true);
    } catch (error) {
      console.error('Failed to load notification details:', error);
      toast.error('Failed to load notification details');
    }
  }

  const fetchAuditLogs = async () => {
    try {
      setIsLoadingAudit(true);
      const response = await apiClient.get_all_mail_items_audit();
      const data = await response.json();
      setMailAuditItems(data.items || []);
      setFilteredMailAuditItems(data.items || []);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
      toast.error('Failed to load audit logs');
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const applyAuditFilters = () => {
    let filtered = [...mailAuditItems];

    if (auditFilters.customer_email) {
      filtered = filtered.filter(item => item.customer_email === auditFilters.customer_email);
    }

    if (auditFilters.status !== 'all') {
      filtered = filtered.filter(item => item.status === auditFilters.status);
    }

    if (auditFilters.date_from) {
      const fromDate = new Date(auditFilters.date_from).setHours(0, 0, 0, 0);
      filtered = filtered.filter(item => new Date(item.date).getTime() >= fromDate);
    }

    if (auditFilters.date_to) {
      const toDate = new Date(auditFilters.date_to).setHours(23, 59, 59, 999);
      filtered = filtered.filter(item => new Date(item.date).getTime() <= toDate);
    }

    setFilteredMailAuditItems(filtered);
  };

  useEffect(() => {
    applyAuditFilters();
  }, [auditFilters, mailAuditItems]);

  const resetAuditFilters = () => {
    setAuditFilters({
      customer_email: '',
      status: 'all',
      date_from: '',
      date_to: ''
    });
  };

  // Helper to get full history list for a mail item
  const getMailHistory = (item: MailItemAudit) => {
    const history: any[] = [];
    
    // Add created event
    if (item.created_at) {
      const isParcel = item.type === 'parcel';
      history.push({
        type: isParcel ? 'parcel_booking' : 'created',
        timestamp: item.created_at,
        details: isParcel ? 'Parcel booking confirmed' : 'Mail item created',
        performed_by: isParcel ? 'customer' : 'system'
      });
    } else {
      // Fallback if created_at missing
       history.push({
        type: 'created',
        timestamp: item.date, // Approximate with received date
        details: 'Mail item received',
        performed_by: 'system'
      });
    }
    
    // Add customer actions
    if (item.actions) {
      item.actions.forEach(action => {
        history.push({
          type: action.type,
          timestamp: action.timestamp,
          details: `Request: ${action.type}${action.notes ? ` - ${action.notes}` : ''}`,
          performed_by: 'customer',
          status: action.status
        });
      });
    }
    
    // Add admin updates
    if (item.updates) {
      item.updates.forEach(update => {
        history.push({
          type: update.action || update.type,
          timestamp: update.timestamp,
          details: update.message,
          performed_by: 'admin',
          admin_notes: update.admin_notes
        });
      });
    }
    
    // Sort by timestamp descending
    return history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  const handleActionFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type and size
      const validTypes = ['image/', 'application/pdf'];
      const isValidType = validTypes.some(type => file.type.startsWith(type));
      
      if (!isValidType) {
        toast.error('Please select an image file (JPEG, PNG) or PDF');
        return;
      }
      
      const maxSize = file.type === 'application/pdf' ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
      if (file.size > maxSize) {
        const maxSizeMB = file.type === 'application/pdf' ? '10MB' : '5MB';
        toast.error(`File size must be less than ${maxSizeMB}`);
        return;
      }
      
      setActionFile(file);
    }
  }

  const handleCompleteAction = async () => {
    if (!selectedNotification) return;

    setIsProcessingAction(true);
    try {
      // If we have a file (scan), upload it first
      let scannedFileKey = undefined;
      
      if (selectedNotification.details.action === 'scan' && actionFile) {
        setUploadingActionFile(true);
        
        try {
          const response = await apiClient.upload_envelope_preview({ file: actionFile });
          const result = await response.json();
          
          if (result.success) {
            scannedFileKey = result.file_key;
            toast.success('Scan uploaded successfully');
          } else {
            throw new Error('Failed to upload scan');
          }
        } catch (uploadError) {
          console.error('Error uploading scan:', uploadError);
          toast.error('Failed to upload scan document');
          setIsProcessingAction(false);
          setUploadingActionFile(false);
          return;
        }
      }

      await apiClient.admin_complete_action({
        notification_id: selectedNotification.id,
        customer_email: selectedNotification.customer_email,
        mail_id: selectedNotification.mail_id || '',
        action: selectedNotification.details.action,
        admin_notes: actionResponse,
        scanned_file_key: scannedFileKey
      });

      toast.success('Action completed and customer notified');
      setShowActionDialog(false);
      fetchNotifications();
      setActionResponse('');
      setActionFile(null);
    } catch (error) {
      console.error('Error completing action:', error);
      toast.error('Failed to complete action');
    } finally {
      setIsProcessingAction(false);
      setUploadingActionFile(false);
    }
  };

  const handleNotificationParcelAction = async (action: 'reminder' | 'received' | 'collected') => {
    if (!selectedNotification) return;

    setIsProcessingAction(true);
    try {
      // Always update details first if we're processing the parcel (received or collected)
      // This ensures any edits made in the dialog are saved
      if (action === 'received' || action === 'collected') {
        // Only update if we have a mail_id (which we should for parcel bookings)
        if (selectedNotification.mail_id) {
          await apiClient.admin_update_parcel_details({
            mail_id: selectedNotification.mail_id,
            customer_email: selectedNotification.customer_email,
            tracking_number: notificationParcelDetails.tracking_number,
            sender: notificationParcelDetails.sender
          });
        }
      }

      if (action === 'reminder') {
        await apiClient.admin_send_parcel_reminder({
          mail_id: selectedNotification.mail_id,
          customer_email: selectedNotification.customer_email
        });
        toast.success('Reminder sent to customer');
      } else if (action === 'received') {
        await apiClient.admin_update_parcel_status({
          mail_id: selectedNotification.mail_id,
          customer_email: selectedNotification.customer_email,
          status: 'received',
          notification_id: selectedNotification.id
        });
        toast.success('Parcel marked as received');
        setShowActionDialog(false);
        fetchNotifications();
      } else if (action === 'collected') {
        await apiClient.admin_update_parcel_status({
          mail_id: selectedNotification.mail_id,
          customer_email: selectedNotification.customer_email,
          status: 'collected',
          notification_id: selectedNotification.id
        });
        toast.success('Parcel marked as collected');
        setShowActionDialog(false);
        fetchNotifications();
      }
    } catch (error) {
      console.error(`Error performing parcel action ${action}:`, error);
      toast.error('Failed to update parcel status');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Parcel Management Handlers
  const handleUpdateParcelStatus = async () => {
    if (!selectedParcelItem) return;
    
    setIsUpdatingParcel(true);
    try {
      await apiClient.admin_update_parcel_status({
        mail_id: selectedParcelItem.id,
        customer_email: selectedParcelItem.customer_email,
        status: parcelStatus
      });
      
      toast.success(`Parcel status updated to ${parcelStatus}`);
      setShowUpdateStatusDialog(false);
      fetchMailAuditItems(); // Refresh list
    } catch (error) {
      console.error('Error updating parcel status:', error);
      toast.error('Failed to update parcel status');
    } finally {
      setIsUpdatingParcel(false);
    }
  };

  const handleUpdateParcelDetails = async () => {
    if (!selectedParcelItem) return;
    
    setIsUpdatingParcel(true);
    try {
      await apiClient.admin_update_parcel_details({
        mail_id: selectedParcelItem.id,
        customer_email: selectedParcelItem.customer_email,
        tracking_number: parcelDetails.tracking_number,
        sender: parcelDetails.sender
      });
      
      toast.success('Parcel details updated');
      setShowEditDetailsDialog(false);
      fetchMailAuditItems(); // Refresh list
    } catch (error) {
      console.error('Error updating parcel details:', error);
      toast.error('Failed to update parcel details');
    } finally {
      setIsUpdatingParcel(false);
    }
  };

  const handleSendParcelReminder = async () => {
    if (!selectedParcelItem) return;
    
    setIsUpdatingParcel(true);
    try {
      await apiClient.admin_send_parcel_reminder({
        mail_id: selectedParcelItem.id,
        customer_email: selectedParcelItem.customer_email
      });
      
      toast.success('Reminder sent to customer');
      setShowSendReminderDialog(false);
    } catch (error) {
      console.error('Error sending reminder:', error);
      toast.error('Failed to send reminder');
    } finally {
      setIsUpdatingParcel(false);
    }
  }

  const handleDeleteMailItem = (item: MailItemAudit, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click
    setMailItemToDelete(item);
    setShowDeleteMailDialog(true);
  }

  const confirmDeleteMailItem = async () => {
    if (!mailItemToDelete) return;
    
    setIsDeletingMailItem(true);
    try {
      await apiClient.delete_mail_item(
        mailItemToDelete.customer_email,
        mailItemToDelete.id
      );
      
      toast.success("Mail item deleted successfully");
      setShowDeleteMailDialog(false);
      setMailItemToDelete(null);
      fetchMailAuditItems(); // Refresh the list
    } catch (error) {
      console.error("Error deleting mail item:", error);
      toast.error("Failed to delete mail item");
    } finally {
      setIsDeletingMailItem(false);
    }
  }

  const openUpdateStatusDialog = (item: MailItemAudit) => {
    setSelectedParcelItem(item);
    setParcelStatus(item.status);
    setShowUpdateStatusDialog(true);
  };

  const openEditDetailsDialog = (item: MailItemAudit) => {
    setSelectedParcelItem(item);
    // Extract tracking number from item or its updates/history if available
    setParcelDetails({
      tracking_number: item.tracking_number || '',
      sender: item.sender
    });
    setShowEditDetailsDialog(true);
  };

  const openSendReminderDialog = (item: MailItemAudit) => {
    setSelectedParcelItem(item);
    setShowSendReminderDialog(true);
  };

  const fetchCustomers = async () => {
    try {
      const response = await apiClient.get_all_customers();
      const data = await response.json();
      setCustomers(data.customers || []);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
      toast.error('Failed to load customers');
    }
  };

  const fetchLocations = async () => {
    try {
      const response = await apiClient.list_locations();
      const data = await response.json();
      setLocations(data || []);
    } catch (error) {
      console.error('Failed to fetch locations:', error);
      toast.error('Failed to load locations');
    }
  };

  const handleCreateMail = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsCreatingMail(true);
      
      let envelope_file_key = mailForm.envelope_file_key;
      
      // Upload file if one is selected
      if (selectedFile) {
        const uploadResult = await handleFileUpload(selectedFile);
        if (uploadResult.success) {
          envelope_file_key = uploadResult.file_key;
        } else {
          toast.error('Failed to upload envelope preview');
          return;
        }
      }
      
      const request: CreateMailItemRequest = {
        customer_email: mailForm.customer_email,
        sender: mailForm.sender,
        priority: mailForm.priority,
        envelope_file_key: envelope_file_key || undefined,
        subscription_plan: mailForm.subscription_plan
      };

      const response = await apiClient.create_mail_item(request);
      const result = await response.json();

      if (result.success) {
        // Enhanced success feedback
        toast.success(`✅ Mail item created successfully for ${mailForm.customer_email}`);
        toast.success(`📧 Email notification sent to customer`);
        
        // Clear form completely
        setMailForm({
          customer_email: '',
          sender: '',
          priority: 'normal',
          envelope_file_key: '',
          subscription_plan: 'receive-and-scan'
        });
        setSelectedFile(null);
        
        // Clear file input by resetting the form
        const form = e.target as HTMLFormElement;
        const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) {
          fileInput.value = '';
        }
        
        // Reset upload progress state
        setUploadingFile(false);
        setUploadProgress(0);
        
        // Refresh notifications in case this generates any
        setTimeout(fetchNotifications, 1000);
      } else {
        toast.error('Failed to create mail item');
      }
    } catch (error) {
      console.error('Failed to create mail item:', error);
      toast.error('Failed to create mail item');
    } finally {
      setIsCreatingMail(false);
    }
  };

    const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsCreatingCustomer(true);
      const request: CreateCustomerRequest = {
        full_name: customerForm.full_name,
        address: customerForm.address,
        mailbox_number: customerForm.mailbox_number,
        email: customerForm.email,
        telephone: customerForm.telephone,
        location_id: customerForm.location_id || undefined,
        subscription_plan: customerForm.subscription_plan,
        status: customerForm.status
      };

      const response = await apiClient.create_customer(request);
      const result = await response.json();

      if (result.success) {
        toast.success(`Customer ${customerForm.full_name} created successfully`);
        setCustomerForm({
          full_name: '',
          address: '',
          mailbox_number: '',
          email: '',
          telephone: '',
          location_id: '',
          subscription_plan: 'receive-and-scan',
          status: 'active'
        });
        setShowCreateCustomer(false);
        fetchCustomers(); // Refresh customer list
      } else {
        toast.error('Failed to create customer');
      }
    } catch (error) {
      console.error('Failed to create customer:', error);
      toast.error('Failed to create customer');
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      setUploadingFile(true);
      setUploadProgress(0);
      
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) return prev;
          return prev + 10;
        });
      }, 100);
      
      const response = await apiClient.upload_envelope_preview({ file }, {});
      const result = await response.json();
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (result.success) {
        toast.success(`File uploaded successfully: ${file.name}`);
        return result;
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Failed to upload file:', error);
      toast.error('Failed to upload file');
      throw error;
    } finally {
      setUploadingFile(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type (images and PDFs)
      const validTypes = ['image/', 'application/pdf'];
      const isValidType = validTypes.some(type => file.type.startsWith(type));
      
      if (!isValidType) {
        toast.error('Please select an image file (JPEG, PNG) or PDF');
        return;
      }
      
      // Validate file size (10MB limit for PDFs, 5MB for images)
      const maxSize = file.type === 'application/pdf' ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
      if (file.size > maxSize) {
        const maxSizeMB = file.type === 'application/pdf' ? '10MB' : '5MB';
        toast.error(`File size must be less than ${maxSizeMB}`);
        return;
      }
      
      setSelectedFile(file);
      toast.success(`Selected: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
    }
  };

  const toggleCustomerStatus = async (customer: Customer) => {
    try {
      // Validate that customer has a valid ID
      if (!customer.id) {
        console.error('Customer ID is missing:', customer);
        toast.error('Cannot update customer: ID is missing');
        return;
      }

      // Add customer to updating set
      setUpdatingCustomers(prev => new Set(prev).add(customer.id!));
      
      const newStatus = customer.status === 'active' ? 'disabled' : 'active';
      
      // Show immediate feedback
      toast.info(`${newStatus === 'active' ? 'Enabling' : 'Disabling'} customer...`);
      
      const response = await apiClient.update_customer(
        { customerId: customer.id },
        { status: newStatus }
      );
      const result = await response.json();
      
      if (result.success) {
        toast.success(`Customer ${newStatus === 'active' ? 'enabled' : 'disabled'} successfully`);
        fetchCustomers(); // Refresh customer list
      } else {
        toast.error('Failed to update customer status');
      }
    } catch (error) {
      console.error('Error updating customer:', error);
      toast.error('Failed to update customer status');
    } finally {
      // Remove customer from updating set
      setUpdatingCustomers(prev => {
        const newSet = new Set(prev);
        newSet.delete(customer.id!);
        return newSet;
      });
    }
  };

  const handleViewCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setCustomerForm({
      full_name: customer.full_name,
      address: customer.address,
      mailbox_number: customer.mailbox_number,
      email: customer.email,
      telephone: customer.telephone,
      location_id: customer.location_id || '',
      subscription_plan: customer.subscription_plan,
      status: customer.status
    });
    setShowEditDialog(true);
  };

  const handleBackToCustomers = () => {
    setSelectedCustomer(null);
  }

  const handleDeleteCustomer = (customer: Customer) => {
    setCustomerToDelete(customer);
    setShowDeleteDialog(true);
  }

  const confirmDeleteCustomer = async () => {
    if (!customerToDelete?.id) {
      toast.error('Customer ID is missing');
      return;
    }

    setIsDeletingCustomer(true);
    
    try {
      const response = await apiClient.delete_customer({ customerId: customerToDelete.id });
      const result = await response.json();
      
      if (result.success) {
        // Show detailed success message
        toast.success(
          result.message, 
          {
            duration: 5000,
            description: result.deletion_summary ? 
              `${result.deletion_summary.length} operations completed` : 
              undefined
          }
        );
        
        // Refresh customers list
        fetchCustomers();
        
        // Close dialog
        setShowDeleteDialog(false);
        setCustomerToDelete(null);
      } else {
        toast.error('Failed to delete customer');
      }
    } catch (error) {
      console.error('Failed to delete customer:', error);
      toast.error('Failed to delete customer. Please try again.');
    } finally {
      setIsDeletingCustomer(false);
    }
  };;

  const handleResendLoginDetails = async (customer: Customer) => {
    if (!confirm(`Are you sure you want to resend login details to ${customer.full_name}?\n\nThis will:\n- Generate a new temporary password\n- Send it to ${customer.email}\n- Invalidate their current password`)) {
      return;
    }

    if (!customer.id) {
      toast.error('Customer ID is missing');
      return;
    }

    setResendingLoginDetails(prev => new Set(prev).add(customer.id!));
    
    try {
      const response = await apiClient.resend_login_details({ email: customer.email });
      const result = await response.json();
      
      if (result.success) {
        toast.success(`Login details sent successfully to ${customer.email}`);
      } else {
        toast.error(result.message || 'Failed to resend login details');
      }
    } catch (error) {
      console.error('Error resending login details:', error);
      toast.error('Failed to resend login details');
    } finally {
      setResendingLoginDetails(prev => {
        const newSet = new Set(prev);
        newSet.delete(customer.id!);
        return newSet;
      });
    }
  };

  const handleSyncStripeCustomers = async () => {
    try {
      setIsSyncingStripe(true);
      const response = await apiClient.sync_stripe_customers();
      const result = await response.json();
      
      if (result.success) {
        toast.success(result.message);
        // Refresh customer list to see any status updates
        fetchCustomers();
      } else {
        toast.error('Sync completed with warnings (check console)');
      }
    } catch (error) {
      console.error('Error syncing with Stripe:', error);
      toast.error('Failed to sync with Stripe');
    } finally {
      setIsSyncingStripe(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchCustomers();
    fetchLocations();
    // Refresh notifications every 30 seconds
    const interval = setInterval(() => {
      fetchNotifications();
      if (activeTab === 'customers') {
        fetchCustomers();
      }
      if (activeTab === 'audit') {
        fetchAuditLogs();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [activeTab]);

  // Initial fetch for audit logs when tab is selected
  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab]);

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img src={LOGO_URL} alt="Letterbox.es" className="h-10 w-10 rounded-full object-cover" />
              <h1 className="text-2xl font-bold text-yellow-500">Letterbox.es Admin</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                variant="outline" 
                onClick={() => navigate("/inbox")}
              >
                View Customer Inbox
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate("/")}
              >
                Back to Home
              </Button>
              <Button 
                variant="outline"
                onClick={handleSyncStripeCustomers}
                disabled={isSyncingStripe}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isSyncingStripe ? 'animate-spin' : ''}`} />
                Sync Stripe
              </Button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Administration Dashboard</h2>
            <p className="text-gray-600">Manage customers, mail, and view notifications</p>
            
            {/* Tab Navigation */}
            <div className="flex space-x-4 mt-4">
              <Button 
                variant={activeTab === 'dashboard' ? 'default' : 'outline'}
                onClick={() => setActiveTab('dashboard')}
                className={activeTab === 'dashboard' ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : ''}
              >
                <Mail className="h-5 w-5" />
                Dashboard
              </Button>
              <Button 
                variant={activeTab === 'customers' ? 'default' : 'outline'}
                onClick={() => setActiveTab('customers')}
                className={activeTab === 'customers' ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : ''}
              >
                <Users className="h-5 w-5 mr-2" />
                Customers ({customers.length})
              </Button>
              <Button 
                variant={activeTab === 'audit' ? 'default' : 'outline'}
                onClick={() => setActiveTab('audit')}
                className={activeTab === 'audit' ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : ''}
              >
                <History className="h-5 w-5 mr-2" />
                Audit Log
              </Button>
              <Button 
                variant={activeTab === 'locations' ? 'default' : 'outline'}
                onClick={() => setActiveTab('locations')}
                className={activeTab === 'locations' ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : ''}
              >
                <MapPin className="h-5 w-5 mr-2" />
                Locations
              </Button>
            </div>
          </div>

          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Create Mail Item */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Plus className="h-5 w-5" />
                  <span>Create Mail Item</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateMail} className="space-y-4">
                  <div className="flex flex-col space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Customer
                    </label>
                    <Popover open={openCustomerSearch} onOpenChange={setOpenCustomerSearch}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openCustomerSearch}
                          className="w-full justify-between"
                        >
                          {mailForm.customer_email
                            ? customers.find((customer) => customer.email === mailForm.customer_email)?.full_name || mailForm.customer_email
                            : "Select customer..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search by name, email, or mailbox..." />
                          <CommandList>
                            <CommandEmpty>No customer found.</CommandEmpty>
                            <CommandGroup>
                              {customers.map((customer) => (
                                <CommandItem
                                  key={customer.email}
                                  value={`${customer.full_name} ${customer.email} ${customer.mailbox_number}`}
                                  onSelect={() => {
                                    setMailForm({
                                      ...mailForm,
                                      customer_email: customer.email,
                                      subscription_plan: customer.subscription_plan || 'receive-only'
                                    });
                                    setOpenCustomerSearch(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      mailForm.customer_email === customer.email ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span className="font-medium">{customer.full_name}</span>
                                    <span className="text-xs text-gray-500">{customer.email} • {customer.mailbox_number}</span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sender
                    </label>
                    <Input
                      value={mailForm.sender}
                      onChange={(e) => setMailForm({...mailForm, sender: e.target.value})}
                      placeholder="HMRC Tax Office"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Priority
                      </label>
                      <Select value={mailForm.priority} onValueChange={(value) => setMailForm({...mailForm, priority: value})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Subscription Plan
                      </label>
                      <Select value={mailForm.subscription_plan} onValueChange={(value) => setMailForm({...mailForm, subscription_plan: value})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="receive-only">Receive Only</SelectItem>
                          <SelectItem value="receive-and-scan">Receive & Scan</SelectItem>
                          <SelectItem value="receive-and-forward">Receive & Forward</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Envelope Preview
                    </label>
                    <div className="space-y-2">
                      <Input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleFileSelect}
                        className="cursor-pointer"
                      />
                      <p className="text-xs text-gray-500">
                        Supported: JPEG, PNG images (max 5MB) or PDF documents (max 10MB)
                      </p>
                      {selectedFile && (
                        <div className="text-sm text-green-600 flex items-center space-x-2">
                          <span>Selected: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedFile(null)}
                          >
                            Remove
                          </Button>
                        </div>
                      )}
                      {uploadingFile && (
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <div className="flex-1">
                              <div className="bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-yellow-500 h-2 rounded-full transition-all duration-300" 
                                  style={{ width: `${uploadProgress}%` }}
                                ></div>
                              </div>
                            </div>
                            <span className="text-sm text-blue-600">{uploadProgress}%</span>
                          </div>
                          <p className="text-sm text-blue-600">Uploading {selectedFile?.name}...</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-black"
                    disabled={isCreatingMail}
                  >
                    {isCreatingMail ? 'Creating...' : 'Create Mail Item'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Admin Notifications */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Bell className="h-5 w-5" />
                    <span>Admin Notifications</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={fetchNotifications}>
                    Refresh
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {notifications.length === 0 ? (
                  <div className="text-center py-8">
                    <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No notifications yet</p>
                    <p className="text-sm text-gray-500 mt-1">Customer actions will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {notifications.map((notification) => (
                      <div 
                        key={notification.id} 
                        className="border border-gray-200 rounded-lg p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Mail className="h-4 w-4 text-gray-500" />
                            <span className="font-medium text-sm">{notification.customer_email}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge 
                              className={`text-xs ${
                                notification.details.action === 'scan' ? 'bg-green-100 text-green-800' :
                                notification.details.action === 'forward' ? 'bg-purple-100 text-purple-800' :
                                notification.details.action === 'hold' ? 'bg-blue-100 text-blue-800' :
                                notification.details.action === 'recycle' ? 'bg-gray-100 text-gray-800' :
                                'bg-red-100 text-red-800'
                              }`}
                            >
                              {notification.details.action ? notification.details.action.toUpperCase() : 
                               notification.type === 'parcel_booking' ? 'PARCEL BOOKING' : 'UNKNOWN'}
                            </Badge>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground mb-2">
                          {notification.type === "parcel_booking" ? (
                            <>
                              <div className="font-medium text-foreground">
                                Parcel from {notification.sender || notification.details?.sender || "Unknown Sender"}
                              </div>
                              <div className="text-xs mt-1">
                                Tracking:{" "}
                                <span className="font-mono bg-muted px-1 py-0.5 rounded">
                                  {notification.details?.tracking_number || "Not provided"}
                                </span>
                              </div>
                            </>
                          ) : (
                            `Mail from ${notification.sender || notification.details?.sender || "Unknown Sender"}`
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDateTime(notification.timestamp)}
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-blue-600 font-medium">
                            Click to take action →
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-6">
              <Card>
                <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 pb-4">
                  <CardTitle className="text-lg">Filter Activity Log</CardTitle>
                  <Button variant="outline" size="sm" onClick={resetAuditFilters} className="text-gray-500 hover:text-gray-900">
                    <X className="h-4 w-4 mr-2" />
                    Reset Filters
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    {/* Customer Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Customer</label>
                      <Popover open={openAuditCustomerSearch} onOpenChange={setOpenAuditCustomerSearch}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={openAuditCustomerSearch}
                            className="w-full justify-between"
                          >
                            {auditFilters.customer_email
                              ? customers.find((c) => c.email === auditFilters.customer_email)?.full_name || auditFilters.customer_email
                              : "All Customers"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search customer..." />
                            <CommandList>
                              <CommandEmpty>No customer found.</CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  value="all"
                                  onSelect={() => {
                                    setAuditFilters(prev => ({ ...prev, customer_email: '' }));
                                    setOpenAuditCustomerSearch(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      auditFilters.customer_email === '' ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  All Customers
                                </CommandItem>
                                {customers.map((customer) => (
                                  <CommandItem
                                    key={customer.email}
                                    value={`${customer.full_name} ${customer.email}`}
                                    onSelect={() => {
                                      setAuditFilters(prev => ({ ...prev, customer_email: customer.email }));
                                      setOpenAuditCustomerSearch(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        auditFilters.customer_email === customer.email ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div className="flex flex-col">
                                      <span className="font-medium">{customer.full_name}</span>
                                      <span className="text-xs text-gray-500">{customer.email}</span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Action Type Filter -> Status Filter */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Status</label>
                      <Select 
                        value={auditFilters.status} 
                        onValueChange={(value) => setAuditFilters(prev => ({ ...prev, status: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="expecting">Expecting Parcel</SelectItem>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="pending">Pending Action</SelectItem>
                          <SelectItem value="scanned">Scanned</SelectItem>
                          <SelectItem value="forwarded">Forwarded</SelectItem>
                          <SelectItem value="held">Held</SelectItem>
                          <SelectItem value="processed">Processed (Recycled/Shredded)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Date Filters */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">From Date</label>
                      <Input 
                        type="date" 
                        value={auditFilters.date_from}
                        onChange={(e) => setAuditFilters(prev => ({ ...prev, date_from: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">To Date</label>
                      <Input 
                        type="date" 
                        value={auditFilters.date_to}
                        onChange={(e) => setAuditFilters(prev => ({ ...prev, date_to: e.target.value }))}
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button 
                      variant="ghost" 
                      onClick={resetAuditFilters}
                      className="text-gray-500 hover:text-gray-900"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Reset Filters
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-0">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Received Date</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Sender</TableHead>
                          <TableHead>Current Status</TableHead>
                          <TableHead>Last Activity</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoadingAudit ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8">
                              <div className="flex justify-center items-center space-x-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-500"></div>
                                <span>Loading mail items...</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : filteredMailAuditItems.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                              No mail items found matching your filters
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredMailAuditItems.map((item) => (
                            <TableRow 
                              key={item.id} 
                              className="cursor-pointer hover:bg-gray-50"
                              onClick={() => {
                                setSelectedMailAuditItem(item);
                                setShowAuditDetailDialog(true);
                              }}
                            >
                              <TableCell className="font-medium whitespace-nowrap">
                                {item.date}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-medium">{item.customer_name || 'Unknown'}</span>
                                  <span className="text-xs text-gray-500">{item.customer_email}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center space-x-2">
                                  <span>{item.sender}</span>
                                  {item.type === 'parcel' && (
                                    <Badge variant="secondary" className="text-[10px] px-1 h-5 bg-purple-100 text-purple-800 border-purple-200">
                                      PARCEL
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={
                                  item.status === 'expecting' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                  item.status === 'new' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                  item.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                  item.status === 'scanned' ? 'bg-green-50 text-green-700 border-green-200' :
                                  'bg-gray-50 text-gray-700 border-gray-200'
                                }>
                                  {item.status === 'expecting' ? 'EXPECTING' : item.status.toUpperCase()}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-gray-500">
                                {item.updates && item.updates.length > 0 
                                  ? formatDateTime(item.updates[item.updates.length - 1].timestamp)
                                  : item.actions && item.actions.length > 0
                                    ? formatDateTime(item.actions[item.actions.length - 1].timestamp)
                                    : 'No activity'}
                              </TableCell>
                              <TableCell className="text-right">
                                {item.type === 'parcel' ? (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" className="h-8 w-8 p-0">
                                        <span className="sr-only">Open menu</span>
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuLabel>Parcel Actions</DropdownMenuLabel>
                                      <DropdownMenuItem onClick={() => {
                                        setSelectedMailAuditItem(item);
                                        setShowAuditDetailDialog(true);
                                      }}>
                                        <Eye className="mr-2 h-4 w-4" />
                                        View History
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => openUpdateStatusDialog(item)}>
                                        <Truck className="mr-2 h-4 w-4" />
                                        Update Status
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => openEditDetailsDialog(item)}>
                                        <Edit className="mr-2 h-4 w-4" />
                                        Edit Details
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => openSendReminderDialog(item)}>
                                        <Bell className="mr-2 h-4 w-4" />
                                        Send Reminder
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem 
                                        onClick={(e) => handleDeleteMailItem(item, e)}
                                        className="text-red-600 hover:text-red-600 focus:text-red-600 focus:bg-red-50"
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete Item
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                ) : (
                                  <div className="flex justify-end space-x-2">
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedMailAuditItem(item);
                                        setShowAuditDetailDialog(true);
                                      }}
                                      title="View History"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={(e) => handleDeleteMailItem(item, e)}
                                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                      title="Delete Item"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="p-4 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 text-center">
                    Showing {filteredMailAuditItems.length} of {mailAuditItems.length} items
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Parcel Management Dialogs */}
          <Dialog open={showUpdateStatusDialog} onOpenChange={setShowUpdateStatusDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Update Parcel Status</DialogTitle>
                <DialogDescription>
                  Change the current status of the parcel. This will notify the customer.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select value={parcelStatus} onValueChange={setParcelStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expecting">Expecting</SelectItem>
                      <SelectItem value="received">Received</SelectItem>
                      <SelectItem value="collected">Collected</SelectItem>
                      <SelectItem value="processed">Processed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={handleUpdateParcelStatus} 
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-black"
                  disabled={isUpdatingParcel}
                >
                  {isUpdatingParcel ? 'Updating...' : 'Update Status'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showEditDetailsDialog} onOpenChange={setShowEditDetailsDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Parcel Details</DialogTitle>
                <DialogDescription>
                  Update tracking number and sender information.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tracking Number</label>
                  <Input 
                    value={parcelDetails.tracking_number}
                    onChange={(e) => setParcelDetails({...parcelDetails, tracking_number: e.target.value})}
                    placeholder="Enter tracking number"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sender / Origin</label>
                  <Input 
                    value={parcelDetails.sender}
                    onChange={(e) => setParcelDetails({...parcelDetails, sender: e.target.value})}
                    placeholder="Enter sender name"
                  />
                </div>
                <Button 
                  onClick={handleUpdateParcelDetails} 
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-black"
                  disabled={isUpdatingParcel}
                >
                  {isUpdatingParcel ? 'Saving...' : 'Save Details'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showSendReminderDialog} onOpenChange={setShowSendReminderDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send Tracking Reminder</DialogTitle>
                <DialogDescription>
                  Send an email reminder to the customer to add tracking information for this parcel booking.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <p className="text-sm text-gray-500 mb-4">
                  This will send an email to <strong>{selectedParcelItem?.customer_email}</strong> requesting them to update the tracking details for this parcel.
                </p>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowSendReminderDialog(false)}>Cancel</Button>
                  <Button 
                    onClick={handleSendParcelReminder} 
                    className="bg-yellow-500 hover:bg-yellow-600 text-black"
                    disabled={isUpdatingParcel}
                  >
                    {isUpdatingParcel ? 'Sending...' : 'Send Reminder'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Delete Mail Item Dialog */}
          <Dialog open={showDeleteMailDialog} onOpenChange={setShowDeleteMailDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2 text-red-600">
                  <Trash2 className="h-5 w-5" />
                  <span>Delete Mail Item</span>
                </DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete this mail item? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              
              {mailItemToDelete && (
                <div className="space-y-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-gray-500">Sender:</span>
                      <span className="font-medium">{mailItemToDelete.sender}</span>
                      <span className="text-gray-500">Date:</span>
                      <span className="font-medium">{mailItemToDelete.date}</span>
                      <span className="text-gray-500">Customer:</span>
                      <span className="font-medium">{mailItemToDelete.customer_email}</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button variant="outline" onClick={() => setShowDeleteMailDialog(false)} disabled={isDeletingMailItem}>
                      Cancel
                    </Button>
                    <Button 
                      variant="destructive"
                      onClick={confirmDeleteMailItem}
                      disabled={isDeletingMailItem}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {isDeletingMailItem ? (
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                          <span>Deleting...</span>
                        </div>
                      ) : (
                        <>Delete Item</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Audit Detail Dialog */}
          <Dialog open={showAuditDetailDialog} onOpenChange={setShowAuditDetailDialog}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Mail Item Audit Trail</DialogTitle>
                <DialogDescription>
                  Full history for mail from {selectedMailAuditItem?.sender}
                </DialogDescription>
              </DialogHeader>
              
              {selectedMailAuditItem && (
                <div className="space-y-6 mt-4">
                  {/* Item Summary */}
                  <div className="bg-gray-50 p-4 rounded-lg grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Customer</p>
                      <p className="font-medium">{selectedMailAuditItem.customer_name} ({selectedMailAuditItem.customer_email})</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Sender</p>
                      <p className="font-medium">{selectedMailAuditItem.sender}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Received Date</p>
                      <p className="font-medium">{selectedMailAuditItem.date}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Current Status</p>
                      <Badge variant="outline" className="mt-1">
                        {selectedMailAuditItem.status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  {/* Envelope Preview */}
                  {selectedMailAuditItem.envelope_preview_url && (
                    <div>
                      <h4 className="font-semibold mb-2">Original Envelope</h4>
                      <div className="border rounded-lg p-4 bg-white">
                        {(() => {
                          const url = getEnvelopeUrl(selectedMailAuditItem.envelope_preview_url);
                          const isPdf = url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('.pdf');
                          
                          if (isPdf) {
                            return (
                              <iframe 
                                src={url} 
                                className="w-full h-[500px] rounded bg-white border" 
                                title="Envelope Preview"
                              />
                            );
                          }
                          
                          return (
                            <>
                              <img 
                                src={url} 
                                alt="Envelope Preview" 
                                className="w-full h-auto rounded"
                                style={{ maxHeight: '500px' }}
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  // The next sibling is the fallback div
                                  const fallback = e.currentTarget.parentElement?.querySelector('.fallback-preview') as HTMLElement;
                                  if (fallback) fallback.style.display = 'block';
                                }}
                              />
                              <div style={{ display: 'none' }} className="fallback-preview text-center py-8 text-gray-500">
                                <Mail className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                                <p>Envelope preview not available</p>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Scanned Content */}
                  {(() => {
                    const scanAction = selectedMailAuditItem.actions?.find((a: any) => 
                      (a.type === 'scan' || a.action === 'scan') && a.file_key
                    );
                    
                    if (!scanAction) return null;
                    
                    const isPdf = scanAction.file_key.toLowerCase().endsWith('.pdf');
                    
                    return (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium mb-2">Scanned Content</h4>
                        <div className="border rounded-md p-2 bg-muted/20">
                          {scanAction.file_key && (
                            scanAction.file_key.toLowerCase().endsWith('.pdf') ? (
                              <iframe 
                                src={getEnvelopeUrl(scanAction.file_key)} 
                                className="w-full h-[300px] rounded bg-white border" 
                                title="Scanned Document"
                              />
                            ) : (
                              <img 
                                src={getEnvelopeUrl(scanAction.file_key)}
                                alt="Scanned Content" 
                                className="max-w-full h-auto max-h-[300px] object-contain mx-auto"
                              />
                            )
                          )}
                        </div>
                        <div className="mt-2 text-right">
                          <a 
                            href={getEnvelopeUrl(scanAction.file_key)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline"
                          >
                            Open in new tab
                          </a>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="relative border-l-2 border-gray-200 ml-3 space-y-8 pb-4">
                    {getMailHistory(selectedMailAuditItem).map((event, index) => (
                      <div key={index} className="relative pl-8">
                        {/* Timeline dot */}
                        <div className={cn(
                          "absolute -left-[9px] top-0 h-4 w-4 rounded-full border-2 bg-white",
                          event.performed_by === 'admin' ? "border-black" : 
                          event.performed_by === 'customer' ? "border-yellow-500" : "border-gray-400"
                        )}></div>
                        
                        <div className="flex flex-col space-y-1">
                          <div className="flex items-center justify-between">
                            <span className={cn(
                              "text-sm font-bold px-2 py-0.5 rounded",
                              event.performed_by === 'admin' ? "bg-black text-white" : 
                              event.performed_by === 'customer' ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-700"
                            )}>
                              {event.type.toUpperCase().replace('_', ' ')}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDateTime(event.timestamp)}
                            </span>
                          </div>
                          
                          <p className="text-sm text-gray-900 font-medium">
                            {event.details}
                          </p>
                          
                          {event.admin_notes && (
                            <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded mt-1 italic">
                              " {event.admin_notes} "
                            </p>
                          )}
                          
                          <span className="text-xs text-gray-500 uppercase">
                            By {event.performed_by}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Action Dialog */}
          <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <Mail className="h-5 w-5" />
                  <span>Complete Customer Action: {selectedNotification?.details.action?.toUpperCase()}</span>
                </DialogTitle>
              </DialogHeader>
              
              {selectedNotification && (
                <div className="space-y-6">
                  {/* Customer & Mail Info */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2 text-sm text-gray-700">Customer Request Details</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Customer:</span>
                        <p className="font-medium">{selectedNotification.customer_name || selectedNotification.customer_email}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Plan:</span>
                        <p className="font-medium">{selectedNotification.subscription_plan}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Origin / Sender:</span>
                        <p className="font-medium">{selectedNotification.sender}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Requested Action:</span>
                        <Badge className={`${
                          selectedNotification.details.action === 'scan' ? 'bg-green-100 text-green-800' :
                          selectedNotification.details.action === 'forward' ? 'bg-purple-100 text-purple-800' :
                          selectedNotification.details.action === 'hold' ? 'bg-blue-100 text-blue-800' :
                          selectedNotification.details.action === 'recycle' ? 'bg-gray-100 text-gray-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {selectedNotification.details.action ? selectedNotification.details.action.toUpperCase() : 
                           selectedNotification.type === 'parcel_booking' ? 'PARCEL BOOKING' : 'UNKNOWN'}
                        </Badge>
                      </div>
                      {(selectedNotification.tracking_number || selectedNotification.type === 'parcel_booking') && (
                         <div className="col-span-2">
                           <span className="text-gray-600">Tracking Number:</span>
                           <p className="font-medium font-mono">
                             {selectedNotification.tracking_number || "Not provided by customer"}
                           </p>
                         </div>
                      )}
                    </div>
                  </div>

                  {/* Envelope Preview */}
                  {selectedNotification.type !== 'parcel_booking' && (
                  <div>
                    <h4 className="font-semibold mb-2">Original Envelope</h4>
                    <div className="border rounded-lg p-4 bg-white">
                      {(() => {
                        // Use envelope_preview_url if available, otherwise try mail_id (though likely incorrect for image src)
                        // Ideally selectedNotification should always have envelope_preview_url populated correctly
                        const url = selectedNotification.envelope_preview_url || getEnvelopeUrl(selectedNotification.mail_id || '');
                        const isPdf = url && (url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('.pdf'));
                        
                        if (isPdf) {
                          return (
                            <iframe 
                              src={url} 
                              className="w-full h-[500px] rounded bg-white border" 
                              title="Envelope Preview"
                            />
                          );
                        }
                        
                        return (
                          <>
                            <img 
                              src={url} 
                              alt="Envelope Preview" 
                              className="w-full h-auto rounded"
                              style={{ maxHeight: '500px' }}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.parentElement?.querySelector('.fallback-preview') as HTMLElement;
                                if (fallback) fallback.style.display = 'block';
                              }}
                            />
                            <div style={{ display: 'none' }} className="fallback-preview text-center py-8 text-gray-500">
                              <Mail className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                              <p>Envelope preview not available</p>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  )}

                  {/* Parcel Actions */}
                  {selectedNotification.type === 'parcel_booking' && (
                    <div className="bg-purple-50 p-4 rounded-lg space-y-4">
                      <h4 className="font-semibold text-purple-900">Parcel Management</h4>
                      
                      {/* Editable Parcel Details */}
                      <div className="grid grid-cols-1 gap-3 bg-white p-3 rounded border border-purple-100 mb-2">
                        <div>
                          <label className="block text-xs font-medium text-purple-900 mb-1">
                            Tracking Number
                          </label>
                          <Input
                            value={notificationParcelDetails.tracking_number}
                            onChange={(e) => setNotificationParcelDetails({...notificationParcelDetails, tracking_number: e.target.value})}
                            placeholder="Enter tracking number"
                            className="bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-purple-900 mb-1">
                            Sender / Origin
                          </label>
                          <Input
                            value={notificationParcelDetails.sender}
                            onChange={(e) => setNotificationParcelDetails({...notificationParcelDetails, sender: e.target.value})}
                            placeholder="Enter sender name"
                            className="bg-white"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <Button 
                          variant="outline"
                          className="bg-white hover:bg-purple-100 border-purple-200 text-purple-900"
                          onClick={() => handleNotificationParcelAction('reminder')}
                          disabled={isProcessingAction || !!selectedNotification.tracking_number}
                          title={selectedNotification.tracking_number ? "Tracking number already provided" : "Remind customer to add tracking number"}
                        >
                          <Mail className="mr-2 h-4 w-4" />
                          Send Reminder
                        </Button>
                        <Button 
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                          onClick={() => handleNotificationParcelAction('received')}
                          disabled={isProcessingAction}
                        >
                          <Truck className="mr-2 h-4 w-4" />
                          Mark Received
                        </Button>
                        <Button 
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleNotificationParcelAction('collected')}
                          disabled={isProcessingAction}
                        >
                          <Check className="mr-2 h-4 w-4" />
                          Mark Collected
                        </Button>
                      </div>
                      {!notificationParcelDetails.tracking_number && (
                        <p className="text-xs text-purple-700 mt-2">
                          * Tracking number is missing. You can send a reminder to the customer.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Action-specific interface */}
                  {selectedNotification.details.action === 'scan' && (
                    <div className="space-y-4">
                      <h4 className="font-semibold">Upload Scanned Document</h4>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Scanned Document (PDF or Image)
                        </label>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={handleActionFileSelect}
                          className="cursor-pointer w-full"
                        />
                        {actionFile && (
                          <div className="mt-2 text-sm text-green-600">
                            ✓ Selected: {actionFile.name} ({(actionFile.size / (1024 * 1024)).toFixed(2)} MB)
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedNotification.details.action === 'forward' && (
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-semibold mb-2">Forwarding Instructions</h4>
                      <p className="text-sm text-blue-800">
                        Complete the forwarding process for this mail item. Ensure proper packaging and tracking.
                      </p>
                    </div>
                  )}

                  {(selectedNotification.details.action === 'hold' || selectedNotification.details.action === 'recycle' || selectedNotification.details.action === 'shred') && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-semibold mb-2">Physical Action Required</h4>
                      <p className="text-sm text-gray-700">
                        {selectedNotification.details.action === 'hold' && 'Place this mail item in the customer\'s hold section for collection.'}
                        {selectedNotification.details.action === 'recycle' && 'Dispose of this mail item via recycling according to company policy.'}
                        {selectedNotification.details.action === 'shred' && 'Securely shred this mail item according to security protocols.'}
                      </p>
                    </div>
                  )}

                  {/* Response/Notes */}
                  {selectedNotification.type !== 'parcel_booking' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Admin Notes & Customer Update
                    </label>
                    <textarea
                      value={actionResponse}
                      onChange={(e) => setActionResponse(e.target.value)}
                      placeholder={`Describe how you completed the ${selectedNotification.details.action} action. This will be sent to the customer.`}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                      rows={4}
                    />
                  </div>
                  )}

                  {/* Actions */}
                  {selectedNotification.type !== 'parcel_booking' && (
                  <div className="flex justify-end space-x-3 pt-4 border-t">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowActionDialog(false)}
                      disabled={isProcessingAction}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleCompleteAction}
                      disabled={isProcessingAction || uploadingActionFile || (selectedNotification.details.action === 'scan' && !actionFile)}
                      className="bg-yellow-500 hover:bg-yellow-600 text-black"
                    >
                      {isProcessingAction ? 'Processing...' : uploadingActionFile ? 'Uploading...' : `Complete ${selectedNotification.details.action?.toUpperCase()}`}
                    </Button>
                  </div>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>

          {activeTab === 'customers' && !selectedCustomer && (
            <div className="space-y-6">
              {/* Customer Management Header */}
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Customer Management</h3>
                  <p className="text-gray-600">Manage customer accounts and subscriptions</p>
                </div>
                <div className="flex items-center space-x-3">
                  <Button 
                    variant="outline"
                    onClick={handleSyncStripeCustomers}
                    disabled={isSyncingStripe}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isSyncingStripe ? 'animate-spin' : ''}`} />
                    Sync Stripe
                  </Button>
                  <Dialog open={showCreateCustomer} onOpenChange={setShowCreateCustomer}>
                    <DialogTrigger asChild>
                      <Button className="bg-yellow-500 hover:bg-yellow-600 text-black">
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add Customer
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Create New Customer</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleCreateCustomer} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Full Name *
                            </label>
                            <Input
                              value={customerForm.full_name}
                              onChange={(e) => setCustomerForm({...customerForm, full_name: e.target.value})}
                              placeholder="John Smith"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Email Address *
                            </label>
                            <Input
                              type="email"
                              value={customerForm.email}
                              onChange={(e) => setCustomerForm({...customerForm, email: e.target.value})}
                              placeholder="john@example.com"
                              required
                            />
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Address *
                          </label>
                          <Input
                            value={customerForm.address}
                            onChange={(e) => setCustomerForm({...customerForm, address: e.target.value})}
                            placeholder="123 Main Street, London, SW1A 1AA"
                            required
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Mailbox Number (Auto-generated if empty)
                            </label>
                            <Input
                              value={customerForm.mailbox_number}
                              onChange={(e) => setCustomerForm({...customerForm, mailbox_number: e.target.value})}
                              placeholder="MBXXXX (Leave blank to auto-generate)"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Telephone
                            </label>
                            <Input 
                              type="tel" 
                              value={customerForm.telephone}
                              onChange={(e) => setCustomerForm({...customerForm, telephone: e.target.value})}
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">Location</label>
                          <Select 
                            value={customerForm.location_id || ''} 
                            onValueChange={(value) => setCustomerForm({...customerForm, location_id: value})}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a location (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None (Default)</SelectItem>
                              {locations.map((loc) => (
                                <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">Customer Status</label>
                          <Select value={customerForm.status || 'active'} onValueChange={(value) => setCustomerForm({ ...customerForm, status: value })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="disabled">Disabled (Non-payment)</SelectItem>
                              <SelectItem value="suspended">Suspended</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">Subscription Plan *</label>
                          <Select value={customerForm.subscription_plan} onValueChange={(value) => setCustomerForm({...customerForm, subscription_plan: value})}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="receive-only">Receive Only</SelectItem>
                              <SelectItem value="receive-and-scan">Receive & Scan</SelectItem>
                              <SelectItem value="receive-and-forward">Receive & Forward</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="flex space-x-3 pt-4">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setShowCreateCustomer(false)}
                          >
                            Cancel
                          </Button>
                          <Button 
                            type="submit" 
                            className="bg-yellow-500 hover:bg-yellow-600 text-black"
                            disabled={isCreatingCustomer}
                          >
                            {isCreatingCustomer ? 'Creating...' : 'Create Customer'}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {/* Customers Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>All Customers</span>
                    <Button variant="outline" size="sm" onClick={fetchCustomers}>
                      Refresh
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {customers.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No customers yet</p>
                      <p className="text-sm text-gray-500 mt-1">Add your first customer to get started</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Mailbox</TableHead>
                            <TableHead>Subscription & Status</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customers.map((customer) => (
                            <TableRow key={customer.id}>
                              <TableCell className="font-medium">{customer.full_name}</TableCell>
                              <TableCell>{customer.email}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{customer.mailbox_number}</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center space-x-2">
                                  <Badge 
                                    className={
                                      customer.subscription_plan === 'receive-only' ? 'bg-blue-100 text-blue-800' :
                                      customer.subscription_plan === 'receive-and-scan' ? 'bg-green-100 text-green-800' :
                                      'bg-purple-100 text-purple-800'
                                    }
                                  >
                                    {customer.subscription_plan === 'receive-only' ? 'Receive Only' :
                                     customer.subscription_plan === 'receive-and-scan' ? 'Receive & Scan' :
                                     'Receive & Forward'}
                                  </Badge>
                                  <Badge 
                                    className={
                                      customer.status === 'active' ? 'bg-green-100 text-green-800' :
                                      customer.status === 'disabled' ? 'bg-red-100 text-red-800' :
                                      'bg-yellow-100 text-yellow-800'
                                    }
                                  >
                                    {customer.status === 'active' ? 'Active' :
                                     customer.status === 'disabled' ? 'Disabled' :
                                     'Suspended'}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-gray-600">{customer.telephone}</TableCell>
                              <TableCell className="text-sm text-gray-600">
                                {customer.created_at ? new Date(customer.created_at).toLocaleDateString() : 'N/A'}
                              </TableCell>
                              <TableCell>
                                <div className="flex space-x-2">
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => handleViewCustomer(customer)}
                                    title="View customer details"
                                  >
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => handleResendLoginDetails(customer)}
                                    disabled={resendingLoginDetails.has(customer.id!)}
                                    title="Resend login details"
                                    className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                  >
                                    {resendingLoginDetails.has(customer.id!) ? (
                                      <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                      <Key className="h-3 w-3" />
                                    )}
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant={customer.status === 'active' ? 'destructive' : 'default'}
                                    onClick={() => toggleCustomerStatus(customer)}
                                    disabled={updatingCustomers.has(customer.id!)}
                                    className={customer.status === 'active' ? '' : 'bg-green-600 hover:bg-green-700 text-white'}
                                    title={customer.status === 'active' ? 'Disable customer' : 'Enable customer'}
                                  >
                                    {updatingCustomers.has(customer.id!) ? (
                                      <div className="flex items-center space-x-1">
                                        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                        <span>Updating...</span>
                                      </div>
                                    ) : (
                                      customer.status === 'active' ? 'Disable' : 'Enable'
                                    )}
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => handleEditCustomer(customer)}
                                    title="Edit customer details"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="destructive" 
                                    onClick={() => handleDeleteCustomer(customer)}
                                    title="Delete customer account"
                                    className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Customer Details View */}
          {activeTab === 'customers' && selectedCustomer && (
            <CustomerDetails 
              customer={selectedCustomer} 
              onBack={handleBackToCustomers}
            />
          )}

          {/* Edit Customer Dialog */}
          <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Customer</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Full Name</label>
                  <Input
                    value={customerForm.full_name}
                    onChange={(e) => setCustomerForm({ ...customerForm, full_name: e.target.value })}
                    placeholder="Enter full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Address</label>
                  <Textarea
                    value={customerForm.address}
                    onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                    placeholder="Enter address"
                    rows={2}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="mailbox_number">Mailbox Number</Label>
                  <Input
                    id="mailbox_number"
                    value={customerForm.mailbox_number}
                    onChange={(e) => setCustomerForm({ ...customerForm, mailbox_number: e.target.value })}
                    placeholder="Enter mailbox number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <Input
                    type="email"
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                    placeholder="Enter email address"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="telephone">Telephone</Label>
                  <Input
                    value={customerForm.telephone}
                    onChange={(e) => setCustomerForm({ ...customerForm, telephone: e.target.value })}
                    placeholder="Enter telephone number"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Location</label>
                  <Select 
                    value={customerForm.location_id || ''} 
                    onValueChange={(value) => setCustomerForm({...customerForm, location_id: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a location (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Default)</SelectItem>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Subscription Plan</label>
                  <Select
                    value={customerForm.subscription_plan}
                    onValueChange={(value) => setCustomerForm({ ...customerForm, subscription_plan: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receive-only">Receive Only</SelectItem>
                      <SelectItem value="receive-and-scan">Receive & Scan</SelectItem>
                      <SelectItem value="receive-and-forward">Receive & Forward</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <Select
                    value={customerForm.status || 'active'}
                    onValueChange={(value) => setCustomerForm({ ...customerForm, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="disabled">Disabled</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex space-x-3 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowEditDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={async () => {
                      if (!editingCustomer?.id) return;
                      
                      try {
                        setIsCreatingCustomer(true);
                        
                        const response = await apiClient.update_customer(
                          { customerId: editingCustomer.id },
                          customerForm
                        );
                        
                        if (response.ok) {
                          toast.success('Customer updated successfully!');
                          setShowEditDialog(false);
                          fetchCustomers(); // Refresh the customer list
                          
                          // Update selected customer if it's the one being edited
                          if (selectedCustomer?.id === editingCustomer.id) {
                            const updatedCustomer = { ...editingCustomer, ...customerForm };
                            setSelectedCustomer(updatedCustomer);
                          }
                        } else {
                          const errorData = await response.json();
                          toast.error(errorData.detail || 'Failed to update customer');
                        }
                      } catch (error) {
                        console.error('Error updating customer:', error);
                        toast.error('Failed to update customer');
                      } finally {
                        setIsCreatingCustomer(false);
                      }
                    }}
                    disabled={isCreatingCustomer}
                    className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-black"
                  >
                    {isCreatingCustomer ? 'Updating...' : 'Update Customer'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Delete Customer Dialog */}
          <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2 text-red-600">
                  <Trash2 className="h-5 w-5" />
                  <span>Delete Customer Account</span>
                </DialogTitle>
                <DialogDescription className="text-gray-600">
                  This action will permanently delete the customer account and all associated data including Firebase authentication, mail items, and notifications.
                </DialogDescription>
              </DialogHeader>
              
              {customerToDelete && (
                <div className="space-y-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                          <span className="text-red-600 text-sm font-bold">!</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-red-800 mb-2">⚠️ This action cannot be undone</h3>
                        <p className="text-sm text-red-700 mb-3">
                          You are about to permanently delete this customer account and all associated data:
                        </p>
                        
                        <div className="bg-white border border-red-200 rounded-lg p-3 mb-3">
                          <p className="text-sm"><strong>Name:</strong> {customerToDelete.full_name}</p>
                          <p className="text-sm"><strong>Email:</strong> {customerToDelete.email}</p>
                          <p className="text-sm"><strong>Mailbox:</strong> {customerToDelete.mailbox_number}</p>
                          <p className="text-sm"><strong>Plan:</strong> {customerToDelete.subscription_plan}</p>
                        </div>
                        
                        <div className="text-xs text-red-600 space-y-1">
                          <p>✗ Firebase authentication account will be deleted</p>
                          <p>✗ All mail items and history will be removed</p>
                          <p>✗ All admin notifications will be cleared</p>
                          <p>✗ Customer will lose access immediately</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-3 pt-4">
                    <Button variant="outline" onClick={() => {
                      setShowDeleteDialog(false);
                      setCustomerToDelete(null);
                    }} disabled={isDeletingCustomer}>
                      Cancel
                    </Button>
                    <Button 
                      variant="destructive"
                      onClick={confirmDeleteCustomer}
                      disabled={isDeletingCustomer}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {isDeletingCustomer ? (
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                          <span>Deleting...</span>
                        </div>
                      ) : (
                        <>Delete Customer</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {activeTab === 'locations' && (
            <AdminLocations />
          )}
        </main>
      </div>
    </AdminGuard>
  );
}
