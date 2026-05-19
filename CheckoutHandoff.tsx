import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiClient } from 'app';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function CheckoutHandoff() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const customerId = searchParams.get('customer_id');

    if (!customerId) {
      setError("Missing customer information.");
      return;
    }

    const initCheckout = async () => {
      try {
        const response = await apiClient.public_create_checkout_session({
          customer_id: customerId
        });
        const data = await response.json();
        
        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error("Invalid checkout response");
        }
      } catch (err: any) {
        console.error(err);
        setError("Failed to initialize checkout. Please contact support.");
        toast.error("Failed to initialize checkout");
      }
    };

    initCheckout();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border-t-4 border-t-yellow-400">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">Preparing Checkout...</CardTitle>
          <CardDescription>
            Please wait while we securely redirect you to payment.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          {error ? (
            <div className="text-red-500 text-center">
              <p className="font-semibold">{error}</p>
              <button 
                onClick={() => navigate('/Login')}
                className="mt-4 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black rounded font-medium transition-colors"
              >
                Go to Login
              </button>
            </div>
          ) : (
            <Loader2 className="h-12 w-12 animate-spin text-yellow-500" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
