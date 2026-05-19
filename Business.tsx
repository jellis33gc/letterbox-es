import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Link } from "react-router-dom";
import { 
  Mail, 
  Users, 
  Shield, 
  Zap, 
  Building, 
  ArrowLeft, 
  Check, 
  Star,
  Globe,
  Settings,
  BarChart3,
  Smartphone
} from "lucide-react";
import { toast } from "sonner";
import { LOGO_URL } from "utils/constants";
import apiClient from "@/apiclient";

export default function Business() {
  const [contactForm, setContactForm] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    expectedUsers: "",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await apiClient.send_support_request({
        name: contactForm.contactName,
        email: contactForm.email,
        subject: `B2B Inquiry from ${contactForm.companyName}`,
        message: `Company: ${contactForm.companyName}\nContact: ${contactForm.contactName}\nPhone: ${contactForm.phone}\nExpected Users: ${contactForm.expectedUsers}\n\nMessage:\n${contactForm.message}`
      });
      
      const result = await response.json();
      if (result.success) {
        toast.success("Thank you! We'll contact you within 24 hours.");
        setContactForm({
          companyName: "",
          contactName: "",
          email: "",
          phone: "",
          expectedUsers: "",
          message: ""
        });
      } else {
        throw new Error("Failed to send inquiry");
      }
    } catch (error) {
      console.error("Contact form error:", error);
      toast.error("Failed to send inquiry. Please try again or contact us directly.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setContactForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link to="/" className="flex items-center space-x-2 text-gray-600 hover:text-yellow-600">
                <ArrowLeft className="h-5 w-5" />
                <span>Back to Home</span>
              </Link>
              <div className="h-6 w-px bg-gray-300"></div>
              <div className="flex items-center space-x-3">
                <img src={LOGO_URL} alt="Letterbox.es" className="h-12 w-12 rounded-full object-cover" />
                <span className="text-xl font-bold text-yellow-500">Letterbox.es</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/" className="text-gray-600 hover:text-yellow-600">Customer Login</Link>
              <Button 
                onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
                className="bg-yellow-500 hover:bg-yellow-600 text-black"
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-yellow-50 to-white py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="bg-yellow-100 text-yellow-800 mb-6">White-Label Solution</Badge>
              <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
                Launch Your Own 
                <span className="text-yellow-500">Digital Mailbox</span> Service
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Offer your customers a complete digital mail management solution under your brand. 
                From envelope scanning to mail forwarding, provide professional postal services with our proven platform.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
                  className="bg-yellow-500 hover:bg-yellow-600 text-black text-lg px-8 py-3"
                >
                  Start Your Service
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                  className="border-yellow-500 text-yellow-600 hover:bg-yellow-50 text-lg px-8 py-3"
                >
                  View Features
                </Button>
              </div>
              <div className="mt-8 flex items-center space-x-6 text-sm text-gray-600">
                <div className="flex items-center space-x-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Complete white-label solution</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Ready in 24 hours</span>
                </div>
              </div>
            </div>
            <div className="lg:pl-8">
              <div className="bg-white rounded-2xl shadow-2xl p-1">
                <img 
                  src="/api/docs" 
                  alt="Admin Dashboard Preview" 
                  className="w-full rounded-xl"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDYwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI2MDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxyZWN0IHg9IjIwIiB5PSIyMCIgd2lkdGg9IjU2MCIgaGVpZ2h0PSI2MCIgZmlsbD0iI0ZEQzQzNSIvPgo8cmVjdCB4PSI0MCIgeT0iMTAwIiB3aWR0aD0iMjYwIiBoZWlnaHQ9IjI4MCIgZmlsbD0iI0Y5RkFGQiIgc3Ryb2tlPSIjRTVFN0VCIiBzdHJva2Utd2lkdGg9IjIiLz4KPHJlY3QgeD0iMzIwIiB5PSIxMDAiIHdpZHRoPSIyNjAiIGhlaWdodD0iMjgwIiBmaWxsPSIjRjlGQUZCIiBzdHJva2U9IiNFNUU3RUIiIHN0cm9rZS13aWR0aD0iMiIvPgo8dGV4dCB4PSIzMDAiIHk9IjUwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTgiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSIjMzc0MTUxIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5BZG1pbiBEYXNoYm9hcmQ8L3RleHQ+Cjx0ZXh0IHg9IjE3MCIgeT0iMTQwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2QjczODAiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkN1c3RvbWVyIE1hbmFnZW1lbnQ8L3RleHQ+Cjx0ZXh0IHg9IjQ1MCIgeT0iMTQwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2QjczODAiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk1haWwgUHJvY2Vzc2luZzwvdGV4dD4KPC9zdmc+";
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Complete White-Label Platform</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Everything you need to launch and operate a professional digital mailbox service under your brand.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                  <Building className="h-6 w-6 text-yellow-600" />
                </div>
                <CardTitle className="text-xl">Your Brand, Your Service</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Complete white-label solution with your logo, colors, and domain. 
                  Customers see your brand throughout their entire experience.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                  <Mail className="h-6 w-6 text-yellow-600" />
                </div>
                <CardTitle className="text-xl">Full Mail Processing</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Envelope scanning, document processing, and mail forwarding. 
                  Three subscription tiers to meet every customer need.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-yellow-600" />
                </div>
                <CardTitle className="text-xl">Customer Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Comprehensive admin dashboard for managing customers, 
                  subscriptions, and processing mail efficiently.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                  <Smartphone className="h-6 w-6 text-yellow-600" />
                </div>
                <CardTitle className="text-xl">Mobile Responsive</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Modern, responsive design that works perfectly on desktop, 
                  tablet, and mobile devices for your customers.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-yellow-600" />
                </div>
                <CardTitle className="text-xl">Secure & Compliant</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Built with enterprise-grade security. Firebase authentication 
                  and encrypted data storage for complete peace of mind.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                  <Zap className="h-6 w-6 text-yellow-600" />
                </div>
                <CardTitle className="text-xl">Quick Setup</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Launch your service in 24 hours. We handle the technical setup 
                  while you focus on growing your business.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Simple, Transparent Pricing</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Scale your business with our flexible pricing structure. Start small and grow as your customer base expands.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Setup Fee */}
            <Card className="border-2 border-yellow-200 shadow-lg">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Settings className="h-6 w-6 text-yellow-600" />
                </div>
                <CardTitle className="text-2xl">Setup</CardTitle>
                <div className="text-4xl font-bold text-yellow-600 mt-4">€100</div>
                <p className="text-gray-600 mt-2">One-time setup fee</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm">Complete white-label setup</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm">Custom domain configuration</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm">Brand customization</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm">Training & support</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Starter Tier */}
            <Card className="border-2 border-gray-200 shadow-lg">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Starter</CardTitle>
                <div className="text-4xl font-bold text-gray-900 mt-4">€49</div>
                <p className="text-gray-600 mt-2">per month</p>
                <Badge className="bg-gray-100 text-gray-800 mt-3">0-100 users</Badge>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm">Up to 100 customer accounts</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm">Full platform access</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm">Email notifications</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm">Basic support</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Growth Tier */}
            <Card className="border-2 border-yellow-400 shadow-lg relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-yellow-500 text-black px-3 py-1">
                  <Star className="h-3 w-3 mr-1" />
                  Popular
                </Badge>
              </div>
              <CardHeader className="text-center pt-8">
                <CardTitle className="text-2xl">Growth</CardTitle>
                <div className="text-4xl font-bold text-yellow-600 mt-4">€69</div>
                <p className="text-gray-600 mt-2">per month</p>
                <Badge className="bg-yellow-100 text-yellow-800 mt-3">101-500 users</Badge>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm">Up to 500 customer accounts</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm">Priority support</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm">Advanced analytics</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm">Custom integrations</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Scale Tier */}
            <Card className="border-2 border-gray-200 shadow-lg">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Scale</CardTitle>
                <div className="text-4xl font-bold text-gray-900 mt-4">€99</div>
                <p className="text-gray-600 mt-2">per month</p>
                <Badge className="bg-gray-100 text-gray-800 mt-3">501-1000 users</Badge>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm">Up to 1000 customer accounts</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm">Dedicated support</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm">API access</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm">White-label mobile app</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Enterprise */}
          <div className="mt-12 text-center">
            <Card className="max-w-2xl mx-auto border-2 border-gray-300 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                    <BarChart3 className="h-6 w-6 text-gray-600" />
                  </div>
                  <CardTitle className="text-3xl">Enterprise</CardTitle>
                </div>
                <p className="text-xl text-gray-600">For large organizations with 1000+ users</p>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm">Unlimited users</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm">Custom development</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm">On-premise deployment</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm">24/7 dedicated support</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm">SLA guarantees</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm">Custom integrations</span>
                    </div>
                  </div>
                </div>
                <Button 
                  onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
                  className="bg-gray-900 hover:bg-gray-800 text-white px-8 py-3"
                >
                  Contact Sales
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Screenshots Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">See the Platform in Action</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Professional interfaces that your customers and team will love to use.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Admin Dashboard</h3>
              <p className="text-gray-600 mb-6">
                Comprehensive management interface for processing mail, managing customers, 
                and monitoring your business operations.
              </p>
              <div className="bg-white rounded-xl shadow-xl p-2">
                <img 
                  src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDYwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI2MDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxyZWN0IHg9IjIwIiB5PSIyMCIgd2lkdGg9IjU2MCIgaGVpZ2h0PSI2MCIgZmlsbD0iI0ZEQzQzNSIvPgo8cmVjdCB4PSI0MCIgeT0iMTAwIiB3aWR0aD0iMjYwIiBoZWlnaHQ9IjI4MCIgZmlsbD0iI0Y5RkFGQiIgc3Ryb2tlPSIjRTVFN0VCIiBzdHJva2Utd2lkdGg9IjIiLz4KPHJlY3QgeD0iMzIwIiB5PSIxMDAiIHdpZHRoPSIyNjAiIGhlaWdodD0iMjgwIiBmaWxsPSIjRjlGQUZCIiBzdHJva2U9IiNFNUU3RUIiIHN0cm9rZS13aWR0aD0iMiIvPgo8dGV4dCB4PSIzMDAiIHk9IjUwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTgiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSIjMzc0MTUxIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5BZG1pbiBEYXNoYm9hcmQ8L3RleHQ+Cjx0ZXh0IHg9IjE3MCIgeT0iMTQwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2QjczODAiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkN1c3RvbWVyIE1hbmFnZW1lbnQ8L3RleHQ+Cjx0ZXh0IHg9IjQ1MCIgeT0iMTQwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2QjczODAiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk1haWwgUHJvY2Vzc2luZzwvdGV4dD4KPC9zdmc+" 
                  alt="Admin Dashboard" 
                  className="w-full rounded-lg"
                />
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Customer Interface</h3>
              <p className="text-gray-600 mb-6">
                Clean, intuitive inbox experience that makes it easy for customers 
                to manage their mail and subscription preferences.
              </p>
              <div className="bg-white rounded-xl shadow-xl p-2">
                <img 
                  src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDYwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI2MDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjRjlGQUZCIi8+CjxyZWN0IHg9IjIwIiB5PSIyMCIgd2lkdGg9IjU2MCIgaGVpZ2h0PSI2MCIgZmlsbD0iI0ZEQzQzNSIvPgo8cmVjdCB4PSI0MCIgeT0iMTAwIiB3aWR0aD0iNTIwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjRkZGRkZGIiBzdHJva2U9IiNFNUU3RUIiIHN0cm9rZS13aWR0aD0iMiIvPgo8cmVjdCB4PSI0MCIgeT0iMjAwIiB3aWR0aD0iNTIwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjRkZGRkZGIiBzdHJva2U9IiNFNUU3RUIiIHN0cm9rZS13aWR0aD0iMiIvPgo8cmVjdCB4PSI0MCIgeT0iMzAwIiB3aWR0aD0iNTIwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjRkZGRkZGIiBzdHJva2U9IiNFNUU3RUIiIHN0cm9rZS13aWR0aD0iMiIvPgo8dGV4dCB4PSIzMDAiIHk9IjUwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTgiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSIjMzc0MTUxIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5DdXN0b21lciBJbmJveDwvdGV4dD4KPHN2ZyB4PSI1MCIgeT0iMTEwIiB3aWR0aD0iNDAiIGhlaWdodD0iNDAiPgo8cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9IiNGM0Y0RjYiLz4KPC9zdmc+Cjx0ZXh0IHg9IjEwMCIgeT0iMTMwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSIjMzc0MTUxIj5NYWlsIGZyb20gQmFuayBvZiBTcGFpbjwvdGV4dD4KPHN2ZyB4PSI1MCIgeT0iMjEwIiB3aWR0aD0iNDAiIGhlaWdodD0iNDAiPgo8cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9IiNGM0Y0RjYiLz4KPC9zdmc+Cjx0ZXh0IHg9IjEwMCIgeT0iMjMwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSIjMzc0MTUxIj5QYWNrYWdlIE5vdGlmaWNhdGlvbjwvdGV4dD4KPC9zdmc+" 
                  alt="Customer Inbox" 
                  className="w-full rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Ready to Get Started?</h2>
            <p className="text-xl text-gray-600">
              Launch your digital mailbox service in 24 hours. Contact our team to discuss your requirements.
            </p>
          </div>

          <Card className="shadow-2xl border-0">
            <CardHeader className="text-center pb-8">
              <CardTitle className="text-2xl">Get Your Quote</CardTitle>
              <p className="text-gray-600 mt-2">Tell us about your business and we'll get back to you within 24 hours</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleContactSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="companyName" className="text-sm font-medium">Company Name</Label>
                    <Input
                      id="companyName"
                      value={contactForm.companyName}
                      onChange={(e) => handleInputChange('companyName', e.target.value)}
                      placeholder="Your company name"
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactName" className="text-sm font-medium">Contact Name</Label>
                    <Input
                      id="contactName"
                      value={contactForm.contactName}
                      onChange={(e) => handleInputChange('contactName', e.target.value)}
                      placeholder="Your full name"
                      required
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={contactForm.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="your@company.com"
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone" className="text-sm font-medium">Phone Number</Label>
                    <Input
                      id="phone"
                      value={contactForm.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="+34 123 456 789"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="expectedUsers" className="text-sm font-medium">Expected Number of Users</Label>
                  <Input
                    id="expectedUsers"
                    value={contactForm.expectedUsers}
                    onChange={(e) => handleInputChange('expectedUsers', e.target.value)}
                    placeholder="e.g., 50-100 users in first year"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="message" className="text-sm font-medium">Tell us about your business</Label>
                  <Textarea
                    id="message"
                    value={contactForm.message}
                    onChange={(e) => handleInputChange('message', e.target.value)}
                    placeholder="Describe your business model, target customers, and any specific requirements..."
                    rows={4}
                    className="mt-1"
                  />
                </div>

                <div className="text-center pt-4">
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="bg-yellow-500 hover:bg-yellow-600 text-black px-12 py-3 text-lg font-semibold"
                  >
                    {isSubmitting ? "Sending..." : "Get Your Quote"}
                  </Button>
                  <p className="text-sm text-gray-600 mt-4">
                    We'll respond within 24 hours with a custom quote and setup timeline.
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <img src={LOGO_URL} alt="Letterbox.es" className="h-12 w-12 rounded-full object-cover" />
                <span className="text-xl font-bold text-yellow-500">Letterbox.es</span>
              </div>
              <p className="text-gray-400">
                Professional digital mailbox solutions for businesses worldwide. 
                Launch your white-label service today.
              </p>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Solutions</h4>
              <ul className="space-y-2 text-gray-400">
                <li>White-Label Platform</li>
                <li>Mail Processing</li>
                <li>Customer Management</li>
                <li>Enterprise Solutions</li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Email: help@letterbox.es</li>
                <li>Phone: +34 123 456 789</li>
                <li>Address: Madrid, Spain</li>
              </ul>
            </div>
          </div>
          <Separator className="my-8 bg-gray-700" />
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              © 2024 Letterbox.es. All rights reserved.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link to="/" className="text-gray-400 hover:text-yellow-500 text-sm">
                Customer Portal
              </Link>
              <span className="text-gray-400 text-sm">Privacy Policy</span>
              <span className="text-gray-400 text-sm">Terms of Service</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
