import { useCurrentUser } from "../app/auth/useCurrentUser";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import React from "react";

// Hardcoded admin emails - must match backend/app/libs/admin_auth.py
const ADMIN_EMAILS = ["info@letterbox.es", "admin@letterbox.es"];

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useCurrentUser();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  if (!user || !user.email || !ADMIN_EMAILS.includes(user.email)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
