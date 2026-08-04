import {type FormEvent, useState} from "react";
import {LoaderCircleIcon} from "lucide-react";

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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {Input} from "@/components/ui/input";
import {
  adminBasePath,
  adminUrl,
  browserAdminPath,
} from "@/shared/AdminPath";

interface Props {
  email: string;
  purpose: "initial" | "reset";
}

interface CompletionResponse {
  email?: string;
  error?: string;
}

export default function AdminPasswordSetupApp({email, purpose}: Props) {
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isReset = purpose === "reset";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch(
        adminUrl("login/set_password/complete", browserAdminPath()),
        {
          body: JSON.stringify({password, passwordConfirmation}),
          headers: {"content-type": "application/json"},
          method: "POST",
        },
      );
      const result = await response.json() as CompletionResponse;
      if (!response.ok) {
        setError(result.error ?? "Unable to save the password.");
        return;
      }

      const signIn = await authClient.signIn.email({
        email: result.email ?? email,
        password,
        rememberMe: true,
      });
      if (signIn.error) {
        window.location.assign(adminUrl("login", browserAdminPath()));
        return;
      }
      window.location.assign(adminBasePath(browserAdminPath()));
    } catch {
      setError("Unable to save the password right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-svh bg-[#fafafa] px-5 py-12 text-foreground">
      <div className="mx-auto flex w-full max-w-lg flex-col justify-center">
        <div className="mb-8 flex justify-center">
          <img
            alt="microfeed"
            className="h-11 w-auto"
            src="/assets/brands/microfeed/horizontal-logo.png"
          />
        </div>

        <Card className="gap-0 overflow-visible rounded-2xl py-0 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-black/10">
          <CardHeader className="gap-2 px-7 pt-7 pb-6 sm:px-9 sm:pt-9">
            <CardTitle>
              <h1 className="text-2xl leading-tight font-semibold tracking-[-0.025em] sm:text-[1.75rem]">
                {isReset ? "Choose a new password" : "Create your admin password"}
              </h1>
            </CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              {isReset
                ? "This replaces your current password and signs out other sessions."
                : "Your dashboard stays locked until this step is complete."}
            </p>
          </CardHeader>

          <CardContent className="px-7 pb-7 sm:px-9 sm:pb-9">
            <form onSubmit={submit}>
              <FieldGroup className="gap-5">
                <Field>
                  <FieldLabel htmlFor="microfeed-setup-email">Email</FieldLabel>
                  <Input
                    className="h-11 rounded-xl bg-muted/40 px-3 text-base shadow-none md:text-base"
                    id="microfeed-setup-email"
                    readOnly
                    type="email"
                    value={email}
                  />
                </Field>

                <Field data-invalid={Boolean(error)}>
                  <FieldLabel htmlFor="microfeed-setup-password">
                    Password
                  </FieldLabel>
                  <Input
                    aria-invalid={Boolean(error)}
                    autoComplete="new-password"
                    autoFocus
                    className="h-11 rounded-xl bg-white px-3 text-base shadow-none md:text-base"
                    id="microfeed-setup-password"
                    maxLength={128}
                    minLength={12}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    type="password"
                    value={password}
                  />
                  <FieldDescription>Use 12 to 128 characters.</FieldDescription>
                </Field>

                <Field data-invalid={Boolean(error)}>
                  <FieldLabel htmlFor="microfeed-setup-password-confirmation">
                    Confirm password
                  </FieldLabel>
                  <Input
                    aria-invalid={Boolean(error)}
                    autoComplete="new-password"
                    className="h-11 rounded-xl bg-white px-3 text-base shadow-none md:text-base"
                    id="microfeed-setup-password-confirmation"
                    maxLength={128}
                    minLength={12}
                    onChange={(event) =>
                      setPasswordConfirmation(event.target.value)
                    }
                    required
                    type="password"
                    value={passwordConfirmation}
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
                  className="h-11 w-full rounded-xl bg-[#2563eb] text-base font-medium text-white shadow-sm hover:bg-[#1d4ed8]"
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
                  {submitting
                    ? "Saving…"
                    : isReset
                      ? "Reset password"
                      : "Create password"}
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
