import React from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft, LogOut, User } from "lucide-react";
import type { User as FirebaseUser } from "firebase/auth";

interface InboxHeaderProps {
  user: FirebaseUser;
  customerName?: string;
  onLogout: () => void;
  logoUrl: string;
}

export function InboxHeader({ user, customerName, onLogout, logoUrl }: InboxHeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-4 min-w-0 flex-1">
          <Link to="/" className="flex items-center space-x-2 text-gray-600 hover:text-yellow-600 flex-shrink-0">
            <ArrowLeft className="h-5 w-5" />
            <span className="hidden md:inline">Back to Home</span>
          </Link>
          <div className="h-6 w-px bg-gray-300 hidden md:block"></div>
          <div className="flex items-center flex-shrink-0">
            <img src={logoUrl} alt="Letterbox.es" className="h-12 w-12 md:h-16 md:w-16 rounded-full object-cover" />
          </div>
        </div>
        <div className="flex items-center space-x-2 flex-shrink-0">
          <span className="text-gray-700 text-sm hidden sm:block truncate max-w-32 md:max-w-48">Welcome, {customerName || user.email}</span>
          <Link to="/profile">
            <Button 
              variant="outline"
              size="sm"
              className="border-yellow-500 text-yellow-600 hover:bg-yellow-500 hover:text-black flex-shrink-0"
            >
              <User className="h-4 w-4" />
              <span className="hidden md:inline ml-1">Profile</span>
            </Button>
          </Link>
          <Button 
            onClick={onLogout}
            variant="outline"
            size="sm"
            className="border-yellow-500 text-yellow-600 hover:bg-yellow-500 hover:text-black flex-shrink-0"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden md:inline ml-1">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
