import {useState} from "react";
import {CheckIcon, MailOpenIcon, Trash2Icon} from "lucide-react";

import {Button} from "@/components/ui/button";
import {showToast} from "@/client/ToastUtils";
import {ADMIN_URLS} from "@/shared/StringUtils";
import {
  CONTACT_MESSAGE_STATUSES,
  type ContactMessageRecord,
} from "@/shared/ContactMessage";

interface Props {
  messages: ContactMessageRecord[];
}

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as T & {error?: string};
  if (!response.ok) {
    throw new Error(body.error ?? "The request failed.");
  }
  return body;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString();
}

export default function ContactMessagesApp({messages: initialMessages}: Props) {
  const [messages, setMessages] = useState(initialMessages);
  const [busy, setBusy] = useState(false);

  const markRead = async (message: ContactMessageRecord) => {
    if (message.status === CONTACT_MESSAGE_STATUSES.READ) return;
    setBusy(true);
    try {
      const updated = await responseJson<ContactMessageRecord>(await fetch(
        ADMIN_URLS.ajaxContactMessage(message.id),
        {method: "PUT"},
      ));
      setMessages((current) => current.map((entry) =>
        entry.id === updated.id ? updated : entry
      ));
      showToast("Message marked as read.", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "The request failed.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (message: ContactMessageRecord) => {
    if (!window.confirm(
      `Delete the message from \`${message.name}\`? This cannot be undone.`,
    )) {
      return;
    }
    setBusy(true);
    try {
      await responseJson(await fetch(
        ADMIN_URLS.ajaxContactMessage(message.id),
        {method: "DELETE"},
      ));
      setMessages((current) => current.filter((entry) =>
        entry.id !== message.id
      ));
      showToast("Message deleted.", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "The request failed.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const unread = messages.filter(
    (message) => message.status === CONTACT_MESSAGE_STATUSES.NEW,
  ).length;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Messages sent through the public contact form.
          {unread > 0 ? ` ${unread} unread.` : ""}
        </p>
      </div>
      <div className="grid gap-3">
        {messages.length === 0 ? (
          <p className="rounded-[14px] border bg-card p-5 text-sm text-muted-foreground shadow-xs">
            No contact messages yet. Messages from the public contact form
            appear here.
          </p>
        ) : messages.map((message) => (
          <div
            className="grid gap-3 rounded-[14px] border bg-card p-4 text-card-foreground shadow-xs"
            key={message.id}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">{message.name}</h2>
                {message.status === CONTACT_MESSAGE_STATUSES.NEW && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    New
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {formatDate(message.date_created)}
                </span>
                <Button
                  disabled={busy}
                  onClick={() => void markRead(message)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {message.status === CONTACT_MESSAGE_STATUSES.READ
                    ? <MailOpenIcon aria-hidden="true" />
                    : <CheckIcon aria-hidden="true" />}
                  {message.status === CONTACT_MESSAGE_STATUSES.READ
                    ? "Read"
                    : "Mark read"}
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => void remove(message)}
                  size="sm"
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2Icon aria-hidden="true" /> Delete
                </Button>
              </div>
            </div>
            <p className="text-sm">
              <a
                className="text-primary hover:underline"
                href={`mailto:${message.email}`}
              >
                {message.email}
              </a>
            </p>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {message.message}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
