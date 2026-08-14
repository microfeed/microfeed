import {
  CONTACT_MESSAGE_STATUSES,
  normalizeContactEmail,
  normalizeContactMessage,
  normalizeContactName,
  type ContactMessageInput,
  type ContactMessageRecord,
  type ContactMessageStatus,
  validateContactEmail,
  validateContactMessage,
  validateContactName,
} from "@/shared/ContactMessage";
import {randomShortUUID} from "@/shared/StringUtils";

export class ContactRequestError extends Error {}

interface ContactMessageRow extends Record<string, unknown> {
  created_at: string;
  email: string;
  id: string;
  message: string;
  name: string;
  status: string;
}

function recordFromRow(row: ContactMessageRow): ContactMessageRecord {
  return {
    date_created: String(row.created_at),
    email: String(row.email),
    id: String(row.id),
    message: String(row.message),
    name: String(row.name),
    status: row.status === CONTACT_MESSAGE_STATUSES.READ
      ? CONTACT_MESSAGE_STATUSES.READ
      : CONTACT_MESSAGE_STATUSES.NEW,
  };
}

function validatedInput(input: ContactMessageInput): {
  email: string;
  message: string;
  name: string;
} {
  const name = normalizeContactName(input.name ?? "");
  const nameError = validateContactName(name);
  if (nameError) throw new ContactRequestError(nameError);
  const email = normalizeContactEmail(input.email ?? "");
  const emailError = validateContactEmail(email);
  if (emailError) throw new ContactRequestError(emailError);
  const message = normalizeContactMessage(input.message ?? "");
  const messageError = validateContactMessage(message);
  if (messageError) throw new ContactRequestError(messageError);
  return {email, message, name};
}

/**
 * Public contact-form submission. Validates the input and inserts a new
 * message with status "new". Never throws for duplicate or conflicting rows;
 * each submission is a fresh row.
 */
export async function createContactMessage(
  database: D1Database,
  input: ContactMessageInput,
): Promise<ContactMessageRecord> {
  const {email, message, name} = validatedInput(input);
  const id = randomShortUUID();
  const now = new Date().toISOString();
  await database.prepare(`
    INSERT INTO contact_messages (id, name, email, message, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    name,
    email,
    message,
    CONTACT_MESSAGE_STATUSES.NEW,
    now,
  ).run();
  return {
    date_created: now,
    email,
    id,
    message,
    name,
    status: CONTACT_MESSAGE_STATUSES.NEW,
  };
}

export async function getContactMessageById(
  database: D1Database,
  id: string,
): Promise<ContactMessageRecord | null> {
  const row = await database.prepare(
    "SELECT * FROM contact_messages WHERE id = ? LIMIT 1",
  ).bind(id).first<ContactMessageRow>();
  return row ? recordFromRow(row) : null;
}

export async function listContactMessages(
  database: D1Database,
): Promise<ContactMessageRecord[]> {
  const result = await database.prepare(`
    SELECT * FROM contact_messages
    ORDER BY created_at DESC, id
  `).all();
  return result.results.map((row) => recordFromRow(row as ContactMessageRow));
}

export async function markContactMessageRead(
  database: D1Database,
  id: string,
): Promise<ContactMessageRecord | null> {
  const existing = await getContactMessageById(database, id);
  if (!existing) return null;
  if (existing.status === CONTACT_MESSAGE_STATUSES.READ) return existing;
  await database.prepare(`
    UPDATE contact_messages SET status = ?
    WHERE id = ?
  `).bind(CONTACT_MESSAGE_STATUSES.READ, id).run();
  return {...existing, status: CONTACT_MESSAGE_STATUSES.READ};
}

export async function deleteContactMessage(
  database: D1Database,
  id: string,
): Promise<boolean> {
  const result = await database.prepare(
    "DELETE FROM contact_messages WHERE id = ?",
  ).bind(id).run();
  return (result.meta.changes ?? 0) > 0;
}

export function contactMessageStatus(
  value: unknown,
): ContactMessageStatus | null {
  return value === CONTACT_MESSAGE_STATUSES.READ ||
      value === CONTACT_MESSAGE_STATUSES.NEW
    ? (value as ContactMessageStatus)
    : null;
}
