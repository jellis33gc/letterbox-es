import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, APP_BASE_PATH } from 'app';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function Signup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    telephone: '',
    address: '',
    subscriptionPlan: 'receive-only',
    subscriptionInterval: 'monthly',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
          full_name: formData.fullName,
          email: formData.email,
          telephone: formData.telephone,
          address: formData.address,
          subscription_plan: formData.subscriptionPlan,
          subscription_interval: formData.subscriptionInterval,
          has_business_address: formData.subscriptionPlan === 'business-address'
      };
      
      toast.info("Registering account...");
      const res = await apiClient.public_signup(payload);
      const data = await res.json();
      
      if (!data.success || !data.customer) {
         throw new Error(data.message || "Failed to create account");
      }

      toast.info("Connecting to Identity Verification...");
      
      const diditPayload = {
          user_id: data.customer.id,
          callback_url: `${window.location.origin}${APP_BASE_PATH === "/" ? "" : APP_BASE_PATH}/checkout-handoff?customer_id=${data.customer.id}` 
      };

      const diditRes = await apiClient.create_kyc_session(diditPayload);
      const diditData = await diditRes.json();

      if (diditData.session_url) {
          window.location.href = diditData.session_url;
      } else {
          throw new Error("Failed to initialize verification session");
      }

    } catch (err: any) {
      toast.error(err.message || 'An error occurred during signup.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-xl shadow-lg border-t-4 border-t-yellow-400">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">Create your Letterbox</CardTitle>
          <CardDescription>
            Sign up for your secure digital mailbox. Verification required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Personal Details</h3>
              
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name / Company Name</Label>
                <Input 
                  id="fullName" 
                  name="fullName" 
                  value={formData.fullName} 
                  onChange={handleInputChange} 
                  required 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input 
                  id="email" 
                  type="email" 
                  name="email" 
                  value={formData.email} 
                  onChange={handleInputChange} 
                  required 
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="telephone">Telephone Number</Label>
                <Input 
                  id="telephone" 
                  type="tel" 
                  name="telephone" 
                  value={formData.telephone} 
                  onChange={handleInputChange} 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Current Physical Address</Label>
                <Input 
                  id="address" 
                  name="address" 
                  value={formData.address} 
                  onChange={handleInputChange} 
                  required 
                />
                <p className="text-xs text-muted-foreground">Used for verification purposes.</p>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-medium">Subscription Setup</h3>
              
              <div className="space-y-2">
                <Label htmlFor="subscriptionPlan">Choose your Plan</Label>
                <Select 
                  value={formData.subscriptionPlan} 
                  onValueChange={(val) => handleSelectChange('subscriptionPlan', val)}
                >
                  <SelectTrigger id="subscriptionPlan">
                    <SelectValue placeholder="Select a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receive-only">Receive Only</SelectItem>
                    <SelectItem value="receive-and-scan">Receive & Scan</SelectItem>
                    <SelectItem value="receive-and-forward">Receive & Forward</SelectItem>
                    <SelectItem value="business-address">Business Address Services</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subscriptionInterval">Billing Interval</Label>
                <Select 
                  value={formData.subscriptionInterval} 
                  onValueChange={(val) => handleSelectChange('subscriptionInterval', val)}
                >
                  <SelectTrigger id="subscriptionInterval">
                    <SelectValue placeholder="Select interval" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="6-month">6 Months</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button type="submit" className="w-full bg-yellow-400 text-black hover:bg-yellow-500 font-medium" disabled={loading}>
              {loading ? "Processing..." : "Continue to Identity Verification"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
