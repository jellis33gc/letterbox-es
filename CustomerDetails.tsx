import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import apiClient from '@/apiclient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Mail, Clock, User, Phone, MapPin, CreditCard, Key, RefreshCw, LogIn } from 'lucide-react';
import type { Customer, MailItem } from 'types';
import { getEnvelopeUrl } from "@/utils/urlHelper";

interface CustomerDetailsProps {
  customer: Customer;
  onBack: () => void;
}

export default function CustomerDetails({ customer, onBack }: CustomerDetailsProps) {
  const [mailItems, setMailItems] = useState<MailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isResendingLoginDetails, setIsResendingLoginDetails] = useState(false);

  const handleResendLoginDetails = async () => {
    if (!confirm(`Are you sure you want to resend login details to ${customer.full_name}?\n\nThis will:\n- Generate a new temporary password\n- Send it to ${customer.email}\n- Invalidate their current password`)) {
      return;
    }

    setIsResendingLoginDetails(true);
    
    try {
      const response = await apiClient.resend_login_details({ email: customer.email });
      const result = await response.json();
      
      if (result.success) {
        toast.success(`Login details sent successfully to ${customer.email}`);
      } else {
        toast.error(result.message || 'Failed to resend login details');
      }
    } catch (error: any) {
      console.error('Resend login details error:', error);
      toast.error('Failed to resend login details. Please try again.');
    } finally {
      setIsResendingLoginDetails(false);
    }
  };

  const fetchCustomerMail = async () => {
    try {
      setLoading(true);
      // Use admin endpoint to get mail for specific customer
      const response = await apiClient.get_customer_mail_for_admin({ customerEmail: customer.email });
      const data = await response.json();
      
      setMailItems(data.mail_items || []);
    } catch (error) {
      console.error('Failed to fetch customer mail:', error);
      toast.error('Failed to load customer mail history');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'new': { color: 'bg-blue-100 text-blue-800', label: 'New' },
      'read': { color: 'bg-gray-100 text-gray-800', label: 'Read' },
      'pending': { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
      'processed': { color: 'bg-green-100 text-green-800', label: 'Processed' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['new'];
    
    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    return (
      <Badge 
        variant={priority === 'urgent' ? 'destructive' : 'secondary'}
        className={priority === 'urgent' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}
      >
        {priority === 'urgent' ? 'Urgent' : 'Normal'}
      </Badge>
    );
  };

  const getRequestedActionBadge = (item: MailItem) => {
    if (!item.actions || item.actions.length === 0) return null;
    
    // Get the most recent action (last in array)
    const latestAction = item.actions[item.actions.length - 1];
    
    const getActionBadgeColor = (actionType: string) => {
      switch (actionType) {
        case 'scan':
          return 'bg-green-100 text-green-800';
        case 'forward':
          return 'bg-purple-100 text-purple-800';
        case 'hold':
          return 'bg-blue-100 text-blue-800';
        case 'recycle':
          return 'bg-gray-100 text-gray-800';
        case 'shred':
          return 'bg-red-100 text-red-800';
        default:
          return 'bg-gray-100 text-gray-800';
      }
    };

    return (
      <Badge className={getActionBadgeColor(latestAction.type || latestAction.action)}>
        {(latestAction.type || latestAction.action || 'UNKNOWN').toUpperCase()} REQUESTED
      </Badge>
    );
  };

  const getSubscriptionBadge = (plan: string) => {
    const planConfig = {
      'receive-only': { color: 'bg-blue-100 text-blue-800', label: 'Receive Only' },
      'receive-and-scan': { color: 'bg-green-100 text-green-800', label: 'Receive & Scan' },
      'receive-and-forward': { color: 'bg-purple-100 text-purple-800', label: 'Receive & Forward' }
    };
    
    const config = planConfig[plan as keyof typeof planConfig] || planConfig['receive-and-scan'];
    
    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  useEffect(() => {
    fetchCustomerMail();
  }, [customer.email]);

  const handleLoginAsCustomer = () => {
    // Open inbox with impersonate parameter in a new tab
    const url = `/inbox?impersonate=${encodeURIComponent(customer.email)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customers
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{customer.full_name}</h2>
            <p className="text-gray-600">Customer Details & Mail History</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            className="text-yellow-600 border-yellow-500 hover:bg-yellow-50"
            onClick={handleLoginAsCustomer}
          >
            <LogIn className="h-4 w-4 mr-2" />
            Login as Customer
          </Button>
          <Button 
            variant="outline" 
            onClick={fetchCustomerMail}
            disabled={loading}
          >
            Refresh Mail
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Customer Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-600">Full Name</label>
              <p className="font-medium">{customer.full_name}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-600">Email</label>
              <p className="font-medium">{customer.email}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-600 flex items-center space-x-1">
                <Phone className="h-3 w-3" />
                <span>Telephone</span>
              </label>
              <p className="font-medium">{customer.telephone}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-600 flex items-center space-x-1">
                <MapPin className="h-3 w-3" />
                <span>Address</span>
              </label>
              <p className="font-medium text-sm">{customer.address}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-600">Mailbox Number</label>
              <Badge variant="outline" className="mt-1">{customer.mailbox_number}</Badge>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-600 flex items-center space-x-1">
                <CreditCard className="h-3 w-3" />
                <span>Subscription Plan</span>
              </label>
              <div className="mt-1 flex items-center gap-2">
                {getSubscriptionBadge(customer.subscription_plan)}
                
                {/* Stripe Status Badge */}
                {(customer as any).subscription_status && (
                  <Badge variant="outline" className={
                    (customer as any).subscription_status === 'active' 
                      ? "bg-green-50 text-green-700 border-green-200" 
                      : "bg-yellow-50 text-yellow-700 border-yellow-200"
                  }>
                    Stripe: {(customer as any).subscription_status}
                  </Badge>
                )}
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-600">Customer Since</label>
              <p className="text-sm text-gray-500">
                {customer.created_at ? formatDate(customer.created_at) : 'N/A'}
              </p>
            </div>
            
            {/* Firebase User Status */}
            <div>
              <label className="text-sm font-medium text-gray-600">Account Status</label>
              <div className="mt-1 space-y-2">
                <Badge 
                  variant={customer.firebase_user_created ? "default" : "destructive"}
                  className={customer.firebase_user_created ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
                >
                  {customer.firebase_user_created ? "✅ Firebase Account" : "❌ No Firebase Account"}
                </Badge>
                
                {customer.firebase_uid && (
                  <p className="text-xs text-gray-500">UID: {customer.firebase_uid}</p>
                )}
              </div>
            </div>
            
            {/* Admin Actions */}
            <div className="pt-4 border-t">
              <label className="text-sm font-medium text-gray-600 mb-3 block">Admin Actions</label>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResendLoginDetails}
                  disabled={isResendingLoginDetails || !customer.firebase_user_created}
                  className="w-full justify-start"
                >
                  {isResendingLoginDetails ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Sending Login Details...
                    </>
                  ) : (
                    <>
                      <Key className="h-4 w-4 mr-2" />
                      Resend Login Details
                    </>
                  )}
                </Button>
                
                {!customer.firebase_user_created && (
                  <p className="text-xs text-red-600">
                    Firebase account required to resend login details
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mail History */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Mail className="h-5 w-5" />
                  <span>Mail History ({mailItems.length})</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin h-8 w-8 border-2 border-yellow-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading mail history...</p>
                </div>
              ) : mailItems.length === 0 ? (
                <div className="text-center py-8">
                  <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No mail items found</p>
                  <p className="text-sm text-gray-500 mt-1">This customer hasn't received any mail yet</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {mailItems.map((item) => (
                    <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="font-medium text-gray-900">From: {item.sender}</h4>
                            {getStatusBadge(item.status)}
                            {getPriorityBadge(item.priority)}
                            {getRequestedActionBadge(item)}
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <div className="flex items-center space-x-1">
                              <Clock className="h-3 w-3" />
                              <span>Received: {formatDate(item.date)}</span>
                            </div>
                            <span>ID: {item.id}</span>
                          </div>
                        </div>
                        
                        {item.envelope_preview_url && (
                          <div className="ml-4">
                            <img 
                              src={getEnvelopeUrl(item.envelope_preview_url)} 
                              alt="Envelope preview" 
                              className="w-20 h-16 object-cover rounded border"
                            />
                          </div>
                        )}
                      </div>
                      
                      {/* Actions taken */}
                      {item.actions && item.actions.length > 0 && (
                        <div className="border-t pt-3 mt-3">
                          <h5 className="text-sm font-medium text-gray-700 mb-2">Actions Taken:</h5>
                          <div className="space-y-2">
                            {item.actions.map((action, actionIndex) => (
                              <div key={actionIndex} className="text-sm bg-gray-50 p-2 rounded">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium capitalize">{action.action}</span>
                                  <span className="text-gray-500">
                                    {formatDateTime(action.timestamp)}
                                  </span>
                                </div>
                                <p className="text-gray-600 text-xs mt-1">
                                  Status: {action.status}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
