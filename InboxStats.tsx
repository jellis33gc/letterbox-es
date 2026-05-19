import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Clock, CheckCircle } from "lucide-react";
import { MailItem } from "utils/mailTypes";
import { cn } from "@/utils/cn";

interface InboxStatsProps {
  mailItems: MailItem[];
  currentFilter: string | null;
  onFilterChange: (filter: string | null) => void;
}

export function InboxStats({ mailItems, currentFilter, onFilterChange }: InboxStatsProps) {
  const newCount = mailItems.filter(item => item.status === 'new').length;
  const pendingCount = mailItems.filter(item => item.status === 'pending').length;
  const processedCount = mailItems.filter(item => item.status === 'processed').length;
  const totalCount = mailItems.length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <Card 
        className={cn(
          "cursor-pointer transition-colors hover:bg-accent/50",
          currentFilter === null && "border-yellow-500 bg-yellow-50/50"
        )}
        onClick={() => onFilterChange(null)}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">All Mail</CardTitle>
          <Mail className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalCount}</div>
        </CardContent>
      </Card>
      
      <Card 
        className={cn(
          "cursor-pointer transition-colors hover:bg-accent/50",
          currentFilter === 'new' && "border-yellow-500 bg-yellow-50/50"
        )}
        onClick={() => onFilterChange('new')}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">New Mail</CardTitle>
          <Mail className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">{newCount}</div>
        </CardContent>
      </Card>
      
      <Card 
        className={cn(
          "cursor-pointer transition-colors hover:bg-accent/50",
          currentFilter === 'pending' && "border-yellow-500 bg-yellow-50/50"
        )}
        onClick={() => onFilterChange('pending')}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending</CardTitle>
          <Clock className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">{pendingCount}</div>
        </CardContent>
      </Card>
      
      <Card 
        className={cn(
          "cursor-pointer transition-colors hover:bg-accent/50",
          currentFilter === 'processed' && "border-yellow-500 bg-yellow-50/50"
        )}
        onClick={() => onFilterChange('processed')}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Processed</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{processedCount}</div>
        </CardContent>
      </Card>
    </div>
  );
}
