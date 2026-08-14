export const CONTACT_MESSAGE_STATUSES = {
  NEW: "new",
  READ: "read",
} as const;

export type ContactMessageStatus =
  typeof CONTACT_MESSAGE_STATUSES[keyof typeof CONTACT_MESSAGE_STATUSES];

export const CONTACT_MESSAGE_STATUS_VALUES: readonly ContactMessageStatus[] = [
  CONTACT_MESSAGE_STATUSES.NEW,
  CONTACT_MESSAGE_STATUSES.READ,
];

export const CONTACT_NAME_MAX_LENGTH = 100;
export const CONTACT_EMAIL_MAX_LENGTH = 254;
export const CONTACT_MESSAGE_MAX_LENGTH = 5000;

export interface ContactMessageRecord {
  date_created: string;
  email: string;
  id: string;
  message: string;
  name: string;
  status: ContactMessageStatus;
}

export interface ContactMessageInput {
  email?: string;
  message?: string;
  name?: string;
}

export function normalizeContactName(value: string): string {
  return value.trim().replace(/\s+/gu, " ").slice(0, CONTACT_NAME_MAX_LENGTH);
}

export function normalizeContactEmail(value: string): string {
  return value.trim().toLocaleLowerCase("en-US")
    .slice(0, CONTACT_EMAIL_MAX_LENGTH);
}

export function normalizeContactMessage(value: string): string {
  return value.trim().slice(0, CONTACT_MESSAGE_MAX_LENGTH);
}

export function validateContactName(value: string): string | null {
  if (!value) return "A name is required.";
  if (value.length > CONTACT_NAME_MAX_LENGTH) {
    return `Names are limited to ${CONTACT_NAME_MAX_LENGTH} characters.`;
  }
  return null;
}

export function validateContactEmail(value: string): string | null {
  if (!value) return "An email address is required.";
  if (value.length > CONTACT_EMAIL_MAX_LENGTH) {
    return `Email addresses are limited to ${CONTACT_EMAIL_MAX_LENGTH} characters.`;
  }
  // A pragmatic email shape: local@domain with a dot in the domain.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)) {
    return "Enter a valid email address.";
  }
  return null;
}

export function validateContactMessage(value: string): string | null {
  if (!value) return "A message is required.";
  if (value.length > CONTACT_MESSAGE_MAX_LENGTH) {
    return `Messages are limited to ${CONTACT_MESSAGE_MAX_LENGTH} characters.`;
  }
  return null;
}
