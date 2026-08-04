import {type FormEvent, useState} from "react";
import {LoaderCircleIcon} from "lucide-react";

import {
  adminBasePath,
  browserAdminPath,
} from "@/shared/AdminPath";
import {authClient} from "@/client/auth-client";
import {Button} from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {Input} from "@/components/ui/input";

function safeRedirect(): string {
  const fallback = adminBasePath(browserAdminPath());
  const requested = new URLSearchParams(window.location.search).get("redirect");
  if (!requested) {
    return fallback;
  }
  const candidate = new URL(requested, window.location.origin);
  return candidate.origin === window.location.origin &&
      candidate.pathname.startsWith(fallback)
    ? `${candidate.pathname}${candidate.search}${candidate.hash}`
    : fallback;
}

export default function AdminLoginApp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await authClient.signIn.email({
        email,
        password,
        rememberMe: true,
      });
      if (result.error) {
        setError("The email or password is incorrect.");
        return;
      }
      window.location.assign(safeRedirect());
    } catch {
      setError("Unable to sign in right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-svh bg-admin-canvas px-5 py-12 text-foreground">
      <div className="mx-auto flex w-full max-w-lg flex-col justify-center">
        <div className="mb-8 flex items-center justify-center gap-3">
          <img
            alt=""
            aria-hidden="true"
            className="size-11"
            src="/assets/favicon/android-chrome-192x192.png"
          />
          <span className="text-2xl font-bold tracking-tight">microfeed</span>
        </div>

        <Card className="gap-0 overflow-visible py-0">
          <CardHeader className="gap-0 px-7 pt-7 pb-6 sm:px-9 sm:pt-9">
            <CardTitle>
              <h1 className="text-2xl leading-tight font-semibold tracking-[-0.025em] sm:text-[1.75rem]">
                Sign in to the admin dashboard
              </h1>
            </CardTitle>
          </CardHeader>

          <CardContent className="px-7 pb-7 sm:px-9 sm:pb-9">
            <form onSubmit={submit}>
              <FieldGroup className="gap-5">
                <Field data-invalid={Boolean(error)}>
                  <FieldLabel htmlFor="microfeed-login-email">
                    Email
                  </FieldLabel>
                  <Input
                    aria-invalid={Boolean(error)}
                    autoComplete="username"
                    autoFocus
                    className="h-11 px-3 text-base md:text-base"
                    id="microfeed-login-email"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    required
                    type="email"
                    value={email}
                  />
                </Field>

                <Field data-invalid={Boolean(error)}>
                  <FieldLabel htmlFor="microfeed-login-password">
                    Password
                  </FieldLabel>
                  <Input
                    aria-invalid={Boolean(error)}
                    autoComplete="current-password"
                    className="h-11 px-3 text-base md:text-base"
                    id="microfeed-login-password"
                    maxLength={128}
                    minLength={12}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    required
                    type="password"
                    value={password}
                  />
                </Field>

                {error && (
                  <FieldError
                    aria-live="polite"
                    className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5"
                  >
                    {error}
                  </FieldError>
                )}

                <Button
                  className="h-11 w-full text-base font-medium"
                  disabled={submitting}
                  size="lg"
                  type="submit"
                >
                  {submitting && (
                    <LoaderCircleIcon
                      aria-hidden="true"
                      className="animate-spin"
                      data-icon="inline-start"
                    />
                  )}
                  {submitting ? "Signing in…" : "Sign in"}
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
