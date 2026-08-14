import {MailOpenIcon} from "lucide-react";

import {ADMIN_URLS} from "@/shared/StringUtils";
import {
  CONTACT_MESSAGE_STATUSES,
  type ContactMessageRecord,
} from "@/shared/ContactMessage";

interface Props {
  messages: ContactMessageRecord[];
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString();
}

/**
 * Compact contact-messages summary shown on the Admin home. Lists the most
 * recent submissions and links to the full inbox for management.
 */
export default function ContactMessagesHomeApp({messages}: Props) {
  const recent = messages.slice(0, 5);
  const unread = messages.filter(
    (message) => message.status === CONTACT_MESSAGE_STATUSES.NEW,
  ).length;

  return (
    <div className="rounded-[14px] border bg-card p-5 text-card-foreground shadow-xs">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-foreground">
          Contact messages
          {unread > 0 && (
            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {unread} unread
            </span>
          )}
        </div>
        <a
          className="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-border bg-background px-3 text-xs font-medium whitespace-nowrap transition-all outline-none select-none hover:bg-muted hover:text-foreground"
          href={ADMIN_URLS.contactMessages()}
        >
          View all
        </a>
      </div>
      {recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No contact messages yet. Messages from the contact form will appear
          here.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {recent.map((message) => (
            <li className="flex items-start justify-between gap-3 py-2" key={message.id}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    {message.name}
                  </span>
                  {message.status === CONTACT_MESSAGE_STATUSES.NEW && (
                    <MailOpenIcon aria-hidden="true" className="size-3.5 shrink-0 text-primary" />
                  )}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {message.email} &middot; {formatDate(message.date_created)}
                </div>
                <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {message.message}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
