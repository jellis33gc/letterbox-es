import { MailItem } from "utils/mailTypes";

// Sample mail data for testing the inbox interface
export const sampleMailItems: MailItem[] = [
  {
    id: "1",
    date: "2024-06-05",
    sender: "HMRC Tax Office",
    status: "new",
    envelopePreview: "https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=400&h=300&fit=crop",
    priority: "urgent",
    customerEmail: "customer@example.com"
  },
  {
    id: "2",
    date: "2024-06-04",
    sender: "Bank of England",
    status: "pending",
    envelopePreview: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&h=300&fit=crop",
    priority: "normal",
    customerEmail: "customer@example.com"
  },
  {
    id: "3",
    date: "2024-06-03",
    sender: "Royal Mail",
    status: "processed",
    envelopePreview: "https://images.unsplash.com/photo-1596526131083-e8c633c948d2?w=400&h=300&fit=crop",
    priority: "normal",
    customerEmail: "customer@example.com"
  },
  {
    id: "4",
    date: "2024-06-02",
    sender: "Local Council",
    status: "processed",
    envelopePreview: "https://images.unsplash.com/photo-1568822617270-2c1579f8dfe2?w=400&h=300&fit=crop",
    priority: "normal",
    customerEmail: "customer@example.com"
  },
  {
    id: "5",
    date: "2024-06-01",
    sender: "British Gas",
    status: "processed",
    envelopePreview: "https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=400&h=300&fit=crop",
    priority: "normal",
    customerEmail: "customer@example.com"
  }
];
