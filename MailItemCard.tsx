import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, Package, Truck } from "lucide-react";
import { MailItem, getStatusColor, formatDate, getAvailableActions, SubscriptionPlan, isUnread } from "utils/mailTypes";
import { getEnvelopeUrl } from "@/utils/urlHelper";

interface MailItemCardProps {
  item: MailItem;
  isLatest?: boolean;
  onAction: (action: string, itemId: string, notes?: string, sender?: string) => void;
  onViewDetails: (item: MailItem) => void;
}

export function MailItemCard({ item, isLatest = false, onAction, onViewDetails }: MailItemCardProps) {
  const [trackingInput, setTrackingInput] = React.useState('');
  const [senderInput, setSenderInput] = React.useState('');

  const getPriorityIcon = (priority: string) => {
    return priority === 'urgent' ? '🔴' : '📬';
  };

  const getRequestedAction = () => {
    if (!item.actions || item.actions.length === 0) return null;
    
    // Get the most recent action (last in array)
    const latestAction = item.actions[item.actions.length - 1];
    return latestAction;
  };

  const getActionBadgeColor = (actionType: string) => {
    switch (actionType) {
      case 'scan':
        return 'bg-green-100 text-green-800';
      case 'forward':
        return 'bg-purple-100 text-purple-800';
      case 'hold':
        return 'bg-blue-100 text-blue-800';
      case 'recycle':
        return 'bg-gray-100 text-gray-800';
      case 'shred':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getActionButtons = () => {
    const subscriptionPlan = item.subscription_plan || 'receive-and-scan';
    const availableActions = getAvailableActions(subscriptionPlan as SubscriptionPlan);

    const buttonConfigs = {
      scan: {
        label: 'Open & Scan',
        className: 'border-green-600 text-green-600 hover:bg-green-600 hover:text-white'
      },
      forward: {
        label: 'Forward',
        className: 'border-purple-600 text-purple-600 hover:bg-purple-600 hover:text-white'
      },
      hold: {
        label: 'Hold',
        className: 'border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white'
      },
      recycle: {
        label: 'Recycle',
        className: 'border-gray-600 text-gray-600 hover:bg-gray-600 hover:text-white'
      },
      shred: {
        label: 'Shred',
        className: 'border-red-600 text-red-600 hover:bg-red-600 hover:text-white'
      }
    };

    return (
      <>
        {availableActions.map(action => {
          const config = buttonConfigs[action as keyof typeof buttonConfigs];
          if (!config) return null;
          
          return (
            <Button 
              key={action}
              size="sm" 
              variant="outline"
              className={config.className}
              onClick={() => onAction(action, item.id)}
            >
              {config.label}
            </Button>
          );
        })}
      </>
    );
  };

  return (
    <Card 
      className={`transition-all duration-200 hover:shadow-lg cursor-pointer ${
        isLatest 
          ? 'border-2 border-yellow-400 bg-yellow-50/30 shadow-md' 
          : isUnread(item.status) 
            ? 'bg-blue-50 border-l-4 border-l-blue-500 hover:shadow-md' 
            : 'hover:shadow-md'
      }`}
    >
      <CardContent className="p-6">
        <div className="flex items-center space-x-6">
          {/* Envelope Preview */}
          <div className="flex-shrink-0">
            <img 
              src={getEnvelopeUrl(item.envelope_preview_url || item.envelopePreview) || (item.type === 'parcel' ? 'https://images.unsplash.com/photo-1556740758-90de374c12ad?w=400&h=300&fit=crop' : 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=400&h=300&fit=crop')} 
              alt={`Envelope from ${item.sender}`}
              className="w-24 h-16 object-cover rounded-lg border border-gray-200"
              onError={(e) => {
                e.currentTarget.src = item.type === 'parcel' 
                  ? 'https://images.unsplash.com/photo-1556740758-90de374c12ad?w=400&h=300&fit=crop' 
                  : 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=400&h=300&fit=crop';
              }}
            />
          </div>
          
          {/* Mail Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className={`text-lg flex items-center space-x-2 ${
                  isUnread(item.status) ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'
                }`}>
                  <span>{item.type === 'parcel' ? <Package className="h-5 w-5 text-amber-700" /> : getPriorityIcon(item.priority)}</span>
                  <span>{item.sender}</span>
                  {isLatest && (
                    <Badge className="bg-yellow-500 text-black hover:bg-yellow-600">
                      Latest
                    </Badge>
                  )}
                </h3>
                <div className={`flex flex-col space-y-1 mt-1 ${
                  isUnread(item.status) ? 'text-gray-700 font-medium' : 'text-gray-600'
                }`}>
                  <div className="flex items-center space-x-1 text-sm">
                    <Calendar className="h-4 w-4" />
                    <span>Received: {formatDate(item.date)}</span>
                  </div>
                  
                  {item.type === 'parcel' && item.tracking_number && (
                    <div className="flex items-center space-x-1 text-sm text-blue-600">
                      <Truck className="h-4 w-4" />
                      <span>Tracking: {item.tracking_number}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge className={getStatusColor(item.status)}>
                  {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </Badge>
                {getRequestedAction() && (
                  <Badge className={getActionBadgeColor(getRequestedAction()!.type)}>
                    {getRequestedAction()!.type.toUpperCase()} REQUESTED
                  </Badge>
                )}
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 mt-4 items-center">
              <Button 
                size="sm" 
                className="bg-yellow-500 hover:bg-yellow-600 text-black"
                onClick={() => onViewDetails(item)}
              >
                View Details
              </Button>
              
              {item.status === 'new' && (
                getActionButtons()
              )}

              {/* Parcel Tracking Input */}
              {item.type === 'parcel' && item.status === 'expecting' && (
                <div className="flex items-center gap-2">
                  <Input 
                    placeholder="Enter tracking number" 
                    value={trackingInput}
                    onChange={(e) => setTrackingInput(e.target.value)}
                    className="h-8 w-40 text-sm"
                    onClick={(e) => e.stopPropagation()} 
                  />
                  <Input 
                    placeholder="Origin (e.g. Amazon)" 
                    value={senderInput}
                    onChange={(e) => setSenderInput(e.target.value)}
                    className="h-8 w-40 text-sm"
                    onClick={(e) => e.stopPropagation()} 
                  />
                  <Button 
                    size="sm"
                    variant="outline"
                    className="h-8 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAction('add_tracking', item.id, trackingInput, senderInput);
                      setTrackingInput('');
                      setSenderInput('');
                    }}
                    disabled={!trackingInput || !senderInput}
                  >
                    Add Tracking
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
