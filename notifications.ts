import { toast } from "sonner";

// Notification utilities for consistent toast messages

export const showSuccess = (message: string) => {
  toast.success(message);
};

export const showError = (message: string) => {
  toast.error(message);
};

export const showInfo = (message: string) => {
  toast.info(message);
};

export const showMailActionSuccess = (action: string, sender: string) => {
  const actionMessages = {
    scan: `Requested to open and scan mail from ${sender}`,
    forward: `Requested to forward mail from ${sender}`,
    hold: `Mail from ${sender} is being held`,
    recycle: `Mail from ${sender} marked for recycling`,
    shred: `Mail from ${sender} marked for shredding`
  };
  
  const message = actionMessages[action as keyof typeof actionMessages] || `Action completed for mail from ${sender}`;
  showSuccess(message);
};

export const showMailActionError = (action: string) => {
  showError(`Failed to process mail action: ${action}`);
};
