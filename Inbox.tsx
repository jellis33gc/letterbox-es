import React, { useState, useEffect } from "react";
import { useCurrentUser, firebaseAuth } from "app";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MailItemCard } from "components/MailItemCard";
import { MailDetailModal } from "components/MailDetailModal";
import { InboxHeader } from "components/InboxHeader";
import { InboxStats } from "components/InboxStats";
import { InboxEmptyState } from "components/InboxEmptyState";
import { LOGO_URL } from "utils/constants";
import { useMailData } from "utils/useMailData";
import { firestoreHelpers, type MailItem as FirestoreMailItem } from "utils/firestore";
import type { MailItem } from "utils/mailTypes";
import apiClient from "@/apiclient";
import { Package } from "lucide-react";

export default function Inbox() {
  const { user, loading } = useCurrentUser();
  const navigate = useNavigate();
  const [selectedItem, setSelectedItem] = useState<MailItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  // Check if admin is impersonating
  const params = new URLSearchParams(window.location.search);
  const impersonateEmail = params.get('impersonate');

  // Use Firestore for mail data
  const {
    mailItems: firestoreMailItems,
    customer,
    isLoading: isLoadingMail,
    error,
    refetch,
    processMailAction,
    initializeSampleData
  } = useMailData(user, impersonateEmail);

  // Handle parcel booking verification
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const parcelSuccess = params.get('parcel_booking');
    const sessionId = params.get('session_id');

    if (parcelSuccess === 'success' && sessionId) {
      // Clear URL params immediately
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);

      const verifyBooking = async () => {
        try {
          toast.info("Verifying your parcel booking...");
          const response = await apiClient.verify_parcel_booking({ session_id: sessionId });
          const data = await response.json();
          
          if (data.success) {
            toast.success("Parcel booking confirmed!");
            refetch();
          } else {
            toast.error(data.message || "Failed to verify booking");
          }
        } catch (error) {
          console.error("Verification error:", error);
          toast.error("Could not verify booking. Please contact support.");
        }
      };

      verifyBooking();
    } else if (parcelSuccess === 'success') {
       toast.success("Parcel booking successful!");
       const newUrl = window.location.pathname;
       window.history.replaceState({}, document.title, newUrl);
       refetch();
    }
  }, [refetch]);

  // Convert Firestore mail items to component format
  const mailItems: MailItem[] = firestoreMailItems.map((item: FirestoreMailItem) => ({
    id: item.id!,
    sender: item.sender,
    date: firestoreHelpers.formatDate(item.dateReceived),
    status: item.status,
    priority: item.priority,
    envelope_preview_url: item.envelopeImageUrl,
    subscription_plan: customer?.subscriptionPlan || 'receive-and-scan',
    actions: item.actionsTaken || [],
    // Legacy support
    envelopePreview: item.envelopeImageUrl,
    customerEmail: item.customerEmail,
    type: item.type || 'letter',
    tracking_number: item.tracking_number
  }));

  const filteredMailItems = mailItems.filter(item => {
    if (filterStatus === null) return true;
    return item.status === filterStatus;
  });

  const handleLogout = async () => {
    try {
      await firebaseAuth.signOut();
      toast.success("Logged out successfully");
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to log out");
    }
  };

  const handleMailAction = async (action: string, itemId: string, notes?: string, sender?: string) => {
    try {
      const item = mailItems.find(mail => mail.id === itemId);
      if (!item) return;

      // Show loading state
      toast.info(`Processing ${action}...`);

      // Process action using Firestore
      await processMailAction(itemId, action, notes, sender);
      
      // Success message is handled in the hook
    } catch (error) {
      console.error('Failed to process mail action:', error);
      toast.error(`Failed to process mail action: ${action}`);
    }
  };



  const handleViewDetails = async (item: MailItem) => {
    setSelectedItem(item);
    setIsModalOpen(true);
    
    // Mark as read if status is 'new'
    if (item.status === 'new') {
      try {
        await apiClient.mark_mail_as_read({ mail_id: item.id });
        // Refresh mail items to show updated status
        refetch();
      } catch (error) {
        console.error('Failed to mark mail as read:', error);
        // Don't show error to user as this is non-critical
      }
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedItem(null);
  };

  const handleRefresh = () => {
    toast.info("Refreshing mailbox...");
    refetch();
  };

  const handleInitializeSampleData = () => {
    initializeSampleData();
  };

  const handleBookParcel = async () => {
    if (!customer) return;
    
    try {
      toast.info("Preparing parcel booking...");
      const response = await apiClient.create_checkout_session({
        product_type: 'parcel',
        success_url: window.location.href + '?parcel_booking=success',
        cancel_url: window.location.href + '?parcel_booking=cancelled',
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
         toast.error("Failed to start parcel booking");
      }
    } catch (error) {
      console.error("Parcel booking error:", error);
      toast.error("Failed to start booking");
    }
  };

  const handleManageBilling = async () => {
    if (!customer) return;
    
    try {
      toast.info("Accessing billing portal...");
      
      // If user has a subscription, open portal. Otherwise, open checkout for their current plan.
      if (customer.stripeSubscriptionId && customer.subscriptionStatus === 'active') {
         const response = await apiClient.create_portal_session({ return_url: window.location.href });
         const data = await response.json();
         if (data.url) {
           window.location.href = data.url;
         } else {
           toast.error("Failed to load billing portal");
         }
      } else {
         // Create checkout session for the assigned plan
         const plan = customer.subscriptionPlan || 'receive-only';
         const response = await apiClient.create_checkout_session({
           price_id: plan,
           success_url: window.location.href + '?billing_success=true',
           cancel_url: window.location.href + '?billing_cancelled=true',
         });
         const data = await response.json();
         if (data.url) {
           window.location.href = data.url;
         } else {
            toast.error("Failed to start checkout");
         }
      }
    } catch (error) {
      console.error("Billing error:", error);
      toast.error("Failed to access billing system");
    }
  };

  const isImpersonating = !!impersonateEmail;

  if (loading || isLoadingMail) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your mailbox...</p>
        </div>
      </div>
    );
  }

  // Show error state if there's an error
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <InboxHeader user={user!} onLogout={handleLogout} logoUrl={LOGO_URL} />
        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center py-16">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Mailbox</h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <div className="space-x-4">
              <Button onClick={handleRefresh} className="bg-yellow-500 hover:bg-yellow-600 text-black">
                Retry
              </Button>
              <Button onClick={handleInitializeSampleData} variant="outline">
                Initialize Sample Data
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {isImpersonating && (
        <div className="bg-yellow-500 text-black px-4 py-2 text-center font-medium shadow-md sticky top-0 z-50 flex justify-between items-center">
          <span>Viewing as {impersonateEmail} (Admin Impersonation Mode)</span>
          <Button variant="outline" size="sm" onClick={() => navigate('/admin')}>
            Back to Admin
          </Button>
        </div>
      )}
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <InboxHeader 
          user={user} 
          customerName={customer?.fullName} 
          onLogout={handleLogout} 
          logoUrl={LOGO_URL} 
        />

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Your Digital Mailbox</h2>
            <p className="text-gray-600">Manage your mail and packages from anywhere</p>
          </div>

          {/* Action Bar */}
          <div className="flex justify-end mb-6 space-x-4">
             <Button onClick={handleBookParcel} className="bg-black text-white hover:bg-gray-800">
               <Package className="mr-2 h-4 w-4" /> Book Parcel Delivery
             </Button>
          </div>

          {/* Mailing Address Card */}
          {customer && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <Card className="bg-white border border-gray-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-medium text-gray-900">Your Mailing Address</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-gray-600 font-mono text-sm leading-relaxed bg-gray-50 p-4 rounded-md border border-gray-100 h-full">
                    <p className="font-bold text-gray-900">{customer.fullName}</p>
                    <p>{customer.mailboxNumber}, {customer.location ? customer.location.name : "Letterbox.es"}</p>
                    {customer.location ? (
                      <>
                        <p>{customer.location.address_line1}</p>
                        {customer.location.address_line2 && <p>{customer.location.address_line2}</p>}
                        <p>{customer.location.city}</p>
                        <p>{customer.location.zip_code}</p>
                        {customer.location.state && <p>{customer.location.state}</p>}
                        <p>{customer.location.country}</p>
                      </>
                    ) : (
                      <>
                        <p>Avenida de Francia, CC Cita, 305</p>
                        <p>Playa Del Ingles</p>
                        <p>35100</p>
                        <p>Las Palmas de Gran Canaria</p>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Use this address for all your correspondence.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white border border-gray-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-medium text-gray-900">Subscription Status</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col h-full">
                  <div className="flex-grow">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-lg font-medium capitalize text-gray-900">
                          {customer.subscriptionPlan?.replace('-', ' ') || 'No Plan'}
                        </h3>
                        <div className="mt-1">
                          {customer.subscriptionStatus?.toLowerCase() === 'active' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Active
                            </span>
                          ) : customer.subscriptionStatus?.toLowerCase() === 'scheduled' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Scheduled
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              {customer.subscriptionStatus || 'Pending Activation'}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button 
                        onClick={handleManageBilling}
                        variant="outline"
                        size="sm"
                        disabled={customer.subscriptionStatus?.toLowerCase() === 'scheduled'}
                        className="text-xs h-8"
                      >
                        {customer.stripeSubscriptionId && customer.subscriptionStatus?.toLowerCase() === 'active' 
                          ? "Manage" 
                          : customer.subscriptionStatus?.toLowerCase() === 'scheduled'
                          ? "Scheduled"
                          : "Activate"}
                      </Button>
                    </div>
                    <p className="text-sm text-gray-600">
                      {customer.subscriptionStatus?.toLowerCase() === 'active' 
                        ? "Your subscription is active."
                        : customer.subscriptionStatus?.toLowerCase() === 'scheduled'
                        ? "Your subscription is scheduled to start soon."
                        : "Please activate your subscription to ensure uninterrupted service."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Stats */}
          <InboxStats 
            mailItems={mailItems} 
            currentFilter={filterStatus}
            onFilterChange={setFilterStatus}
          />

          {/* Mail Items */}
          {filteredMailItems.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-gray-400 text-6xl mb-4">📬</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No mail found</h3>
              <p className="text-gray-600 mb-6">
                {filterStatus 
                  ? `No ${filterStatus} mail found.` 
                  : "When you receive mail, it will appear here."}
              </p>
              {filterStatus ? (
                <Button onClick={() => setFilterStatus(null)} className="bg-yellow-500 hover:bg-yellow-600 text-black">
                  Show All Mail
                </Button>
              ) : (
                <Button onClick={handleRefresh} className="bg-yellow-500 hover:bg-yellow-600 text-black">
                  Refresh Mailbox
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredMailItems.map((item, index) => (
                <MailItemCard
                  key={item.id}
                  item={item}
                  isLatest={index === 0}
                  onAction={handleMailAction}
                  onViewDetails={handleViewDetails}
                />
              ))}
            </div>
          )}
        </main>

        {/* Mail Detail Modal */}
        <MailDetailModal
          item={selectedItem}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onAction={handleMailAction}
        />
      </div>
    </div>
  );
}
