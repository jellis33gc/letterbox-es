import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, Lock, Edit, X, Check, CreditCard } from "lucide-react";
import { useUserGuardContext } from "app";
import { updatePassword } from "firebase/auth";
import apiClient from "@/apiclient";
import type { GetCustomerByEmailResponse, UpdateCustomerRequest } from "types";

interface CustomerProfile {
  id: string;
  full_name: string;
  address: string;
  mailbox_number: string;
  email: string;
  telephone: string;
  subscription_plan: string;
  status: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  subscription_status?: string;
}

export default function Profile() {
  const { user } = useUserGuardContext();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isManagingBilling, setIsManagingBilling] = useState(false);

  // Form states
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    console.log('Profile useEffect triggered, user:', user);
    console.log('User email:', user?.email);
    console.log('User uid:', user?.uid);
    console.log('User emailVerified:', user?.emailVerified);
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      console.log('=== PROFILE LOAD START ===');
      console.log('Loading profile for user:', user.uid, user.email);
      console.log('User object:', user);
      
      if (!user.email) {
        console.error('No email found for current user:', user);
        toast.error("No email found for current user");
        return;
      }
      
      console.log('About to call apiClient.get_customer_by_email with email:', user.email);
      
      const response = await apiClient.get_customer_by_email({ email: user.email });
      const data: GetCustomerByEmailResponse = await response.json();
      
      if (data.success && data.customer) {
        console.log('✅ Customer data loaded successfully:', data.customer);
        setProfile(data.customer);
        setEmail(data.customer.email);
        setPhone(data.customer.telephone || "");
        setAddress(data.customer.address || "");
      } else {
        console.error('❌ No customer data found for user:', user.email);
        console.log('API response:', data);
        toast.error("Customer profile not found. Please contact support.");
      }
    } catch (error) {
      console.error("❌ Error loading profile:", error);
      console.log('Error details:', error);
      toast.error("Failed to load profile data");
    } finally {
      console.log('=== PROFILE LOAD END ===');
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !profile.id) return;

    try {
      setIsSaving(true);

      const updateData: UpdateCustomerRequest = {
        email,
        telephone: phone,
        address
      };

      const response = await apiClient.update_customer({ customerId: profile.id }, updateData);
      
      if (response.ok) {
        // Update local state
        setProfile({ ...profile, email, telephone: phone, address });
        setIsEditingProfile(false);
        toast.success("Profile updated successfully!");
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    // Reset form fields to original values
    if (profile) {
      setEmail(profile.email);
      setPhone(profile.telephone || "");
      setAddress(profile.address || "");
    }
    setIsEditingProfile(false);
  };

  const handleManageBilling = async () => {
    if (!profile) return;
    
    try {
      setIsManagingBilling(true);
      
      // If user has a subscription, open portal. Otherwise, open checkout for their current plan.
      if (profile.stripe_subscription_id && profile.subscription_status === 'active') {
         const response = await apiClient.create_portal_session({ return_url: window.location.href });
         const data = await response.json();
         if (data.url) {
           window.location.href = data.url;
         } else {
           toast.error("Failed to load billing portal");
         }
      } else {
         // Create checkout session for the assigned plan
         // We assume the plan name in DB matches the key in backend map or is 'receive-only' default
         const plan = profile.subscription_plan || 'receive-only';
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
    } finally {
      setIsManagingBilling(false);
    }
  };

  useEffect(() => {
    // Check for billing return parameters
    const params = new URLSearchParams(window.location.search);
    if (params.get('billing_success')) {
      toast.success("Subscription updated successfully!");
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    try {
      setIsChangingPassword(true);

      // Update password in Firebase Auth
      await updatePassword(user, newPassword);

      // Clear password fields
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      toast.success("Password changed successfully!");
    } catch (error: any) {
      console.error("Error changing password:", error);
      let errorMessage = "Failed to change password";

      if (error.code === "auth/requires-recent-login") {
        errorMessage = "Please log out and log in again before changing your password";
      }

      toast.error(errorMessage);
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/inbox')}
              className="flex items-center space-x-2 text-gray-600 hover:text-yellow-600"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back to Inbox</span>
            </Button>
          </div>
          <h1 className="text-2xl font-bold text-yellow-500">Profile Settings</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Profile Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Save className="h-5 w-5" />
                  <span>Profile Information</span>
                </div>
                {!isEditingProfile ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingProfile(true)}
                    className="border-yellow-500 text-yellow-600 hover:bg-yellow-500 hover:text-black"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCancelEdit}
                      className="border-gray-300 text-gray-600 hover:bg-gray-100"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  {isEditingProfile ? (
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      required
                    />
                  ) : (
                    <div className="mt-1 p-3 bg-gray-50 border border-gray-200 rounded-md">
                      <p className="text-lg">{profile?.email || 'Not provided'}</p>
                    </div>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  {isEditingProfile ? (
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+44 20 1234 5678"
                    />
                  ) : (
                    <div className="mt-1 p-3 bg-gray-50 border border-gray-200 rounded-md">
                      <p className="text-lg">{profile?.telephone || 'Not provided'}</p>
                    </div>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="address">Physical Address</Label>
                  {isEditingProfile ? (
                    <Input
                      id="address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="123 Main Street, City, Postcode"
                    />
                  ) : (
                    <div className="mt-1 p-3 bg-gray-50 border border-gray-200 rounded-md">
                      <p className="text-lg">{profile?.address || 'Not provided'}</p>
                    </div>
                  )}
                </div>

                {/* Read-only Subscription Plan */}
                <div>
                  <Label className="text-sm font-medium text-gray-500">Current Subscription Plan</Label>
                  <div className="mt-1 p-3 bg-gray-50 border border-gray-200 rounded-md">
                    <p className="text-lg font-medium capitalize text-yellow-600">
                      {profile?.subscription_plan.replace('-', ' ') || 'Not assigned'}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Contact support to change your subscription plan
                    </p>
                  </div>
                </div>
                
                {isEditingProfile && (
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-black"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    {isSaving ? "Saving Changes..." : "Save Changes"}
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Password Change */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Lock className="h-5 w-5" />
                <span>Change Password</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                </div>

                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isChangingPassword || !newPassword || !confirmPassword}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-black"
                >
                  {isChangingPassword ? "Changing Password..." : "Change Password"}
                </Button>
              </form>
            </CardContent>
          </Card>

        </div>

        {/* Account Information Display */}
        {profile && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Full Name</Label>
                  <p className="text-lg">{profile.full_name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Mailbox Number</Label>
                  <p className="text-lg">{profile.mailbox_number}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Subscription Plan</Label>
                  <p className="text-lg capitalize">{profile.subscription_plan.replace('-', ' ')}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Current Email</Label>
                  <p className="text-lg">{profile.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Billing Section */}
        {profile && (
          <Card className="mt-8 border-yellow-200 bg-yellow-50/30">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CreditCard className="h-5 w-5 text-yellow-600" />
                <span>Billing & Subscription</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-100 rounded-full">
                    <CreditCard className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-lg">Billing & Plan</h3>
                      {profile.subscription_status?.toLowerCase() === 'active' ? (
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">Active</span>
                      ) : profile.subscription_status?.toLowerCase() === 'scheduled' ? (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">Scheduled</span>
                      ) : (
                        <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">Inactive</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {profile.subscription_status?.toLowerCase() === 'active' 
                        ? "Your subscription is active. You can manage your payment method and invoices here."
                        : profile.subscription_status?.toLowerCase() === 'scheduled'
                        ? "Your subscription is scheduled to start soon. You will be billed when the plan activates."
                        : "Please activate your subscription to ensure uninterrupted service."}
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={handleManageBilling} 
                  disabled={isManagingBilling || profile.subscription_status?.toLowerCase() === 'scheduled'}
                  className="bg-yellow-500 hover:bg-yellow-600 text-black min-w-[180px]"
                >
                  {isManagingBilling ? "Loading..." : 
                    (profile.stripe_subscription_id && profile.subscription_status?.toLowerCase() === 'active' 
                      ? "Manage Subscription" 
                      : profile.subscription_status?.toLowerCase() === 'scheduled'
                      ? "Scheduled"
                      : "Activate Subscription")
                  }
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
