


import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link, useNavigate } from "react-router-dom";
import { useCurrentUser, firebaseAuth } from "app";
import { signInWithEmailAndPassword } from "firebase/auth";
import { toast } from "sonner";
import apiClient from "@/apiclient";

const logoUrl = "https://static.riff.new/public/72a09fee-63c7-4a83-89a0-c96523f98160/openmail.jpg";

export default function App() {
  const { user, loading } = useCurrentUser();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogging, setIsLogging] = useState(false);
  const [error, setError] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Login form submitted', { email, password: password ? 'provided' : 'empty' });
    
    if (!email || !password) {
      toast.error("Please enter both email and password");
      return;
    }

    setIsLogging(true);
    setError(""); // Clear any previous errors
    
    try {
      console.log('Attempting Firebase login...');
      await signInWithEmailAndPassword(firebaseAuth, email, password);
      toast.success("Login successful!");
      // Check if admin user and redirect accordingly
      if (email === "admin@letterbox.es") {
        console.log('Redirecting to admin dashboard');
        navigate('/admin');
      } else {
        console.log('Redirecting to inbox');
        navigate('/inbox');
      }
    } catch (error: any) {
      console.error("Login error:", error);
      let errorMessage = "Login failed. Please try again.";
      
      if (error.code === "auth/user-not-found") {
        errorMessage = "No account found with this email address.";
      } else if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
        errorMessage = "Incorrect password. Please try again.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address format.";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many login attempts. Please try again later.";
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLogging(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setError("Please enter your email address first.");
      return;
    }

    setIsResettingPassword(true);
    setError("");

    try {
      const response = await apiClient.send_password_reset_email({ email });
      const result = await response.json();
      
      if (result.success) {
        toast.success("Password reset email sent! Check your inbox.");
        setError("");
      } else {
        setError("Failed to send reset email. Please try again.");
      }
    } catch (error) {
      console.error("Password reset error:", error);
      setError("Failed to send reset email. Please contact support if this continues.");
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleLogout = async () => {
    try {
      await firebaseAuth.signOut();
      toast.success("Logged out successfully");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to log out");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-800">
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img src={logoUrl} alt="Letterbox.es" className="h-10 w-10 rounded-full object-cover" />
              <span className="text-xl font-bold text-yellow-500">Letterbox.es</span>
            </div>
            <div className="flex items-center space-x-6">
              <Link to="/business" className="text-gray-600 hover:text-yellow-600 font-medium">
                Business Solutions
              </Link>
              {!user && (
                <span className="text-gray-600">Customer Login</span>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
        {/* Login Section - Only show if not logged in */}
        {!user && (
          <div className="w-full max-w-md mx-auto px-4">
            <div className="text-center mb-8">
              <img src={logoUrl} alt="Letterbox.es" className="h-24 w-24 rounded-full object-cover mx-auto mb-4" />
              <h1 className="text-4xl font-bold text-yellow-500 mb-2">Letterbox.es</h1>
              <p className="text-gray-600">Access your digital mailbox</p>
            </div>
            
            <Card className="shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl text-center text-gray-900">Customer Login</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <div>
                    <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      required
                      className="h-10"
                      autoComplete="email"
                    />
                  </div>
                  <div>
                    <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className="h-10"
                      autoComplete="current-password"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-black h-10 font-semibold"
                    disabled={isLogging || !email || !password}
                    onClick={(e) => {
                      console.log('Login button clicked', { isLogging, email, password: password ? 'provided' : 'empty' });
                    }}
                  >
                    {isLogging ? "Signing in..." : "Sign In to Mailbox"}
                  </Button>
                  <Button 
                    type="button"
                    variant="outline"
                    className="w-full border-yellow-500 text-yellow-600 hover:bg-yellow-50 h-10 font-semibold"
                    disabled={isResettingPassword || !email}
                    onClick={handlePasswordReset}
                  >
                    {isResettingPassword ? "Sending Reset Email..." : "Reset Password"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Welcome Section - Show if logged in */}
        {user && (
          <div className="w-full max-w-md mx-auto px-4">
            <div className="text-center mb-8">
              <img src={logoUrl} alt="Letterbox.es" className="h-24 w-24 rounded-full object-cover mx-auto mb-4" />
              <h1 className="text-4xl font-bold text-yellow-500 mb-2">Letterbox.es</h1>
              <p className="text-gray-600">Welcome to your digital mailbox</p>
            </div>
            
            <Card className="shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl text-center text-gray-900">Welcome Back</CardTitle>
                <p className="text-center text-gray-600 text-sm">Logged in as {user.email}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {user.email === "admin@letterbox.es" ? (
                  <Button 
                    onClick={() => navigate('/admin')}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-black h-10 font-semibold"
                  >
                    Go to Admin Dashboard
                  </Button>
                ) : (
                  <Button 
                    onClick={() => navigate('/inbox')}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-black h-10 font-semibold"
                  >
                    Go to Inbox
                  </Button>
                )}
                <Button 
                  onClick={handleLogout}
                  variant="outline"
                  className="w-full border-yellow-500 text-yellow-600 hover:bg-yellow-500 hover:text-black h-10 font-semibold"
                >
                  Logout
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
