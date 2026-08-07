import {AlertTriangleIcon, CheckIcon, XIcon} from "lucide-react";
import {useState} from "react";

import {authClient} from "@/client/auth-client";
import {Button} from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  OAUTH_SCOPE_DESCRIPTIONS,
  OAUTH_SCOPES,
  type OAuthClientSummary,
} from "@/shared/OAuth";

interface Props {
  client: OAuthClientSummary;
  instanceName: string;
  instanceOrigin: string;
  requestedScopes: string[];
}

export default function OAuthConsentApp({
  client,
  instanceName,
  instanceOrigin,
  requestedScopes,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const decide = async (accept: boolean) => {
    setSubmitting(true);
    setError("");
    try {
      const result = await authClient.oauth2.consent({accept});
      if (result.error || !result.data?.url) {
        setError(result.error?.message ?? "Unable to finish authorization.");
        return;
      }
      window.location.assign(result.data.url);
    } catch {
      setError("Unable to finish authorization. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-svh bg-admin-canvas px-5 py-12 text-foreground">
      <div className="mx-auto flex w-full max-w-xl flex-col justify-center">
        <div className="mb-8 flex items-center justify-center gap-3">
          <img alt="" aria-hidden="true" className="size-11" src="/assets/favicon/android-chrome-192x192.png" />
          <span className="text-2xl font-bold tracking-tight">microfeed</span>
        </div>
        <Card className="gap-0 overflow-visible py-0">
          <CardHeader className="border-b px-7 pt-7 pb-6 sm:px-9 sm:pt-9">
            <CardTitle>
              <h1 className="text-2xl leading-tight font-semibold tracking-[-0.025em]">
                Allow {client.name} to access this microfeed?
              </h1>
            </CardTitle>
            <CardDescription className="mt-2">
              <strong className="text-foreground">{instanceName}</strong>
              <span className="block break-all">{instanceOrigin}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 px-7 py-6 sm:px-9">
            <div>
              <h2 className="font-medium">Requested permissions</h2>
              <ul className="mt-3 grid gap-3">
                {requestedScopes.map((scope) => (
                  <li className="flex items-start gap-3" key={scope}>
                    <CheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    <div>
                      <p className="font-medium">{OAUTH_SCOPE_DESCRIPTIONS[scope] ?? scope}</p>
                      <code className="text-xs text-muted-foreground">{scope}</code>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            {requestedScopes.includes(OAUTH_SCOPES.WRITE) && (
              <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                <AlertTriangleIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-400" />
                <p>Write access includes permission to delete items and replace channel content.</p>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Your password is never shared with the application. You can revoke this access later from API → OAuth Apps.
            </p>
            {error && <p aria-live="polite" className="text-sm text-destructive">{error}</p>}
          </CardContent>
          <CardFooter className="justify-end gap-3 px-7 py-5 sm:px-9">
            <Button disabled={submitting} onClick={() => void decide(false)} type="button" variant="outline">
              <XIcon aria-hidden="true" /> Deny
            </Button>
            <Button disabled={submitting} onClick={() => void decide(true)} type="button">
              <CheckIcon aria-hidden="true" /> {submitting ? "Authorizing…" : "Allow"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
