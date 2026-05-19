import { mode, Mode } from "app";

export const getEnvelopeUrl = (fileKeyOrUrl: string | undefined | null) => {
  if (!fileKeyOrUrl) return '';
  
  // If it's an external URL (e.g. Unsplash for test data), return as is
  // But check it doesn't contain our internal API paths which might need fixing
  if (fileKeyOrUrl.startsWith('http') && 
      !fileKeyOrUrl.includes('/api/customer-management/envelope/') && 
      !fileKeyOrUrl.includes('/api/envelope/')) {
    return fileKeyOrUrl;
  }
  
  // If it contains /envelope/, extract the key to handle legacy/stored URLs
  if (fileKeyOrUrl.includes('/envelope/')) {
     const parts = fileKeyOrUrl.split('/envelope/');
     // Use the part after the last /envelope/
     const key = parts[parts.length - 1];
     // Recurse with just the key to rebuild the correct URL
     return getEnvelopeUrl(key);
  }

  // It is a key, construct the correct URL
  const apiBase = mode === Mode.DEV 
    ? "/_projects/72a09fee-63c7-4a83-89a0-c96523f98160/dbtn/devx/app/routes" 
    : "/api";
  return `${apiBase}/envelope/${fileKeyOrUrl}`;
};
