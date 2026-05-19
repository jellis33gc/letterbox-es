import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, ArrowLeft, Mail, Package } from "lucide-react";
import { MailItem, getStatusColor, formatDate, getAvailableActions, SubscriptionPlan } from "utils/mailTypes";
import { getEnvelopeUrl } from "@/utils/urlHelper";

interface MailDetailModalProps {
  item: MailItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAction: (action: string, itemId: string) => void;
}

export function MailDetailModal({ item, isOpen, onClose, onAction }: MailDetailModalProps) {
  if (!item) return null;

  const getPriorityIcon = (priority: string) => {
    return priority === 'urgent' ? '🔴' : '📬';
  };

  // Debug logging to see what data we're receiving
  console.log('=== MAIL DETAIL MODAL DEBUG ===');
  console.log('Item object:', item);
  console.log('Has updates property:', 'updates' in item);
  console.log('Updates value:', item.updates);
  console.log('Updates length:', item.updates?.length || 0);
  console.log('Item keys:', Object.keys(item));

  const getActionButtons = () => {
    const subscriptionPlan = item.subscription_plan || 'receive-and-scan';
    const availableActions = getAvailableActions(subscriptionPlan as SubscriptionPlan);

    const buttonConfigs = {
      scan: {
        label: 'Open & Scan',
        className: 'bg-green-600 hover:bg-green-700 text-white',
        description: 'Open the mail and scan contents'
      },
      forward: {
        label: 'Forward Mail',
        className: 'bg-purple-600 hover:bg-purple-700 text-white',
        description: 'Forward this mail to your address'
      },
      hold: {
        label: 'Hold Mail',
        className: 'bg-blue-600 hover:bg-blue-700 text-white',
        description: 'Keep mail safe for collection'
      },
      recycle: {
        label: 'Recycle',
        className: 'bg-gray-600 hover:bg-gray-700 text-white',
        description: 'Dispose of mail responsibly'
      },
      shred: {
        label: 'Shred & Dispose',
        className: 'bg-red-600 hover:bg-red-700 text-white',
        description: 'Securely destroy mail contents'
      }
    };

    return availableActions.map(action => {
      const config = buttonConfigs[action as keyof typeof buttonConfigs];
      if (!config) return null;
      
      return (
        <Button 
          key={action}
          className={`${config.className} flex-1 min-w-0`}
          onClick={() => {
            onAction(action, item.id);
            onClose();
          }}
          disabled={item.status === 'pending'}
        >
          <div className="text-center">
            <div className="font-semibold">{config.label}</div>
            <div className="text-xs opacity-90 mt-1">{config.description}</div>
          </div>
        </Button>
      );
    });
  };

  const getSubscriptionPlanName = (plan: string) => {
    switch (plan) {
      case 'receive-only':
        return 'Receive Only';
      case 'receive-and-scan':
        return 'Receive & Scan';
      case 'receive-and-forward':
        return 'Receive & Forward';
      default:
        return plan;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="flex items-center space-x-1 text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Inbox</span>
              </Button>
            </div>
            <Badge className={getStatusColor(item.status)}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Mail item details and available actions based on your subscription plan: {getSubscriptionPlanName(item.subscription_plan || 'receive-and-scan')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Mail Header Info */}
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
                  <span>{getPriorityIcon(item.priority)}</span>
                  <span>Mail from {item.sender}</span>
                </h2>
                <div className="flex items-center space-x-6 text-gray-600 mt-2">
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-4 w-4" />
                    <span>Received: {formatDate(item.date)}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Package className="h-4 w-4" />
                    <span>Plan: {getSubscriptionPlanName(item.subscription_plan)}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Mail className="h-4 w-4" />
                    <span>Priority: {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Envelope Preview */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Envelope Preview</h3>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              {(() => {
                const url = getEnvelopeUrl(item.envelope_preview_url || item.envelopePreview);
                const isPdf = url && (url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('.pdf'));
                
                if (isPdf) {
                  return (
                    <iframe 
                      src={url} 
                      className="w-full h-[500px] rounded bg-white border" 
                      title="Envelope Preview"
                    />
                  );
                }
                
                return (
                  <img 
                    src={url} 
                    alt={`Envelope from ${item.sender}`}
                    className="w-full max-w-2xl mx-auto h-auto rounded-lg shadow-sm"
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=800&h=600&fit=crop';
                    }}
                  />
                );
              })()}
            </div>
          </div>

          {/* Action History */}
          {item.actions && item.actions.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Action History</h3>
              <div className="bg-white border border-gray-200 rounded-lg">
                {item.actions.map((action: any, index: number) => (
                  <div key={action.id || index} className="p-4 border-b border-gray-100 last:border-b-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <span className="font-medium text-gray-900">
                          {action.type.charAt(0).toUpperCase() + action.type.slice(1)} Action
                        </span>
                        {action.notes && (
                          <p className="text-sm text-gray-600 mt-1">{action.notes}</p>
                        )}
                        
                        {/* Display admin notes for completed actions */}
                        {action.status === 'completed' && action.admin_notes && (
                          <div className="bg-green-100 border border-green-200 rounded-lg p-3 mt-2">
                            <p className="text-sm text-green-800">
                              <strong>Notes from our team:</strong> {action.admin_notes}
                            </p>
                          </div>
                        )}
                        
                        {/* Display completion timestamp for completed actions */}
                        {action.status === 'completed' && action.completed_at && (
                          <p className="text-sm text-gray-500 mt-1">
                            Completed: {new Date(action.completed_at).toLocaleString('en-GB', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-sm text-gray-500">
                          {action.status === 'completed' && action.completed_at 
                            ? `Requested: ${new Date(action.timestamp).toLocaleString('en-GB', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}`
                            : new Date(action.timestamp).toLocaleString('en-GB', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                          }
                        </div>
                        <Badge className={`mt-1 text-xs ${
                          action.status === 'completed' 
                            ? 'bg-green-100 text-green-800' 
                            : action.status === 'pending'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {action.status || 'Completed'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Admin Updates & Scanned Documents */}
          {item.actions && item.actions.length > 0 && item.actions.some((action: any) => action.status === 'completed' && action.file_key) && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">📄 Completed Actions & Documents</h3>
              <div className="bg-green-50 border border-green-200 rounded-lg">
                {item.actions
                  .filter((action: any) => action.status === 'completed' && action.file_key)
                  .map((action: any, index: number) => (
                  <div key={action.id || index} className="p-4 border-b border-green-100 last:border-b-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="font-medium text-green-800 text-lg">
                            📞 {action.type.charAt(0).toUpperCase() + action.type.slice(1)} Completed
                          </span>
                          <Badge className="bg-green-100 text-green-800">Completed</Badge>
                        </div>
                        
                        {action.admin_notes && (
                          <div className="bg-green-100 border border-green-200 rounded-lg p-3 mb-3">
                            <p className="text-sm text-green-800">
                              <strong>Notes from our team:</strong> {action.admin_notes}
                            </p>
                          </div>
                        )}
                        
                        {/* Scanned Document Download */}
                        {action.file_key && (
                          <div className="bg-white border border-green-300 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <span className="text-3xl">📄</span>
                                <div>
                                  <p className="font-medium text-green-800 text-lg">Scanned Document Ready</p>
                                  <p className="text-sm text-green-600">Your document has been scanned and is ready for download</p>
                                </div>
                              </div>
                              <Button 
                                size="lg"
                                className="bg-green-600 hover:bg-green-700 text-white font-medium"
                                onClick={() => {
                                  const url = getEnvelopeUrl(action.file_key);
                                  window.open(url, '_blank');
                                }}
                              >
                                📄 Download Document
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="text-right ml-4">
                        <div className="text-sm text-gray-500">
                          Completed: {new Date(action.completed_at).toLocaleString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {item.status === 'new' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Available Actions</h3>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800 mb-4">
                  <strong>Your Plan:</strong> {getSubscriptionPlanName(item.subscription_plan)}
                  <br />
                  Choose an action for this mail item. Once processed, you'll receive a confirmation email.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {getActionButtons()}
                </div>
              </div>
            </div>
          )}

          {item.status === 'pending' && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
                <span className="text-orange-800 font-medium">Action in Progress</span>
              </div>
              <p className="text-sm text-orange-700 mt-2">
                Your action is being processed. You'll receive an email confirmation once complete.
              </p>
            </div>
          )}

          {item.status === 'processed' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                <span className="text-green-800 font-medium">Action Completed</span>
              </div>
              <p className="text-sm text-green-700 mt-2">
                This mail item has been processed according to your request.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
