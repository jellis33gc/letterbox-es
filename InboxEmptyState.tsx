import React from "react";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";

interface InboxEmptyStateProps {
  onRefresh: () => void;
}

export function InboxEmptyState({ onRefresh }: InboxEmptyStateProps) {
  return (
    <div className="text-center py-16">
      <Mail className="h-16 w-16 text-gray-400 mx-auto mb-4" />
      <h3 className="text-xl font-semibold text-gray-900 mb-2">No mail yet</h3>
      <p className="text-gray-600 mb-6">When you receive mail, it will appear here.</p>
      <Button 
        onClick={onRefresh}
        className="bg-yellow-500 hover:bg-yellow-600 text-black"
      >
        Refresh Mailbox
      </Button>
    </div>
  );
}
