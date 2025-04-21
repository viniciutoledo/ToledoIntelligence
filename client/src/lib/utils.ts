import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format date to locale string
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString();
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Validate email
export function isValidEmail(email: string): boolean {
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(email);
}

// Validate password (min 12 chars, uppercase, lowercase, number, special char)
export function isValidPassword(password: string): boolean {
  const minLength = password.length >= 12;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  
  return minLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;
}

// Get password strength message
export function getPasswordStrength(password: string): {
  score: number;
  message: string;
  color: string;
} {
  if (!password) {
    return { score: 0, message: '', color: 'bg-neutral-200' };
  }
  
  let score = 0;
  
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  
  let message = '';
  let color = '';
  
  switch (score) {
    case 0:
    case 1:
      message = 'Very weak';
      color = 'bg-red-500';
      break;
    case 2:
      message = 'Weak';
      color = 'bg-orange-500';
      break;
    case 3:
      message = 'Moderate';
      color = 'bg-yellow-500';
      break;
    case 4:
      message = 'Strong';
      color = 'bg-green-400';
      break;
    case 5:
      message = 'Very strong';
      color = 'bg-green-600';
      break;
    default:
      message = '';
      color = 'bg-neutral-200';
  }
  
  return { score, message, color };
}

// Generate avatar initials from email
export function getInitials(email: string): string {
  if (!email) return '';
  
  const name = email.split('@')[0];
  return name.substring(0, 2).toUpperCase();
}

// Safely parse JSON
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch (e) {
    return fallback;
  }
}

// Mask email for privacy
export function maskEmail(email: string): string {
  if (!email) return '';
  
  const [name, domain] = email.split('@');
  
  if (!domain) return email;
  
  const maskedName = name.substring(0, 2) + '***';
  return `${maskedName}@${domain}`;
}

// Function to handle file upload errors
export function getFileErrorMessage(error: any): string {
  if (error.message.includes('size')) {
    return 'File is too large. Maximum size is 50MB.';
  }
  
  if (error.message.includes('format') || error.message.includes('type')) {
    return 'Unsupported file format. Please upload PNG, JPG, PDF, or TXT.';
  }
  
  return 'Error uploading file. Please try again.';
}
