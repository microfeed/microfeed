import {useState} from "react";
import {
  ChevronDownIcon,
  CircleUserRoundIcon,
  LogOutIcon,
  SettingsIcon,
  ShieldAlertIcon,
} from "lucide-react";

import {Button} from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {adminUrl} from "@/shared/AdminPath";
import type {AdminIdentitySummary} from "./admin-shell-types";

interface Props extends AdminIdentitySummary {
  adminPath: string;
  defaultOpen?: boolean;
}

export function adminLogoutDestination(
  adminPath: string,
  cloudflareAccessDetected: boolean,
): string {
  return cloudflareAccessDetected
    ? "/cdn-cgi/access/logout"
    : adminUrl("login", adminPath);
}

export function adminAccountSettingsDestination(adminPath: string): string {
  return adminUrl("account", adminPath);
}

export function displayedAdminIdentities(
  identity: AdminIdentitySummary,
): Array<{label: string; value: string}> {
  const identities: Array<{label: string; value: string}> = [];
  if (identity.builtInEmail) {
    identities.push({label: "Built-in login", value: identity.builtInEmail});
  }
  if (identity.cloudflareAccessDetected) {
    identities.push({
      label: "Cloudflare Access",
      value: identity.cloudflareAccessEmail || "Protected by Cloudflare Access",
    });
  }
  return identities;
}

export default function AdminUserMenu({
  adminPath,
  builtInEmail,
  cloudflareAccessDetected,
  cloudflareAccessEmail,
  defaultOpen = false,
}: Props) {
  const [error, setError] = useState("");
  const [open, setOpen] = useState(defaultOpen);
  const [signingOut, setSigningOut] = useState(false);
  const identities = displayedAdminIdentities({
    builtInEmail,
    cloudflareAccessDetected,
    cloudflareAccessEmail,
  });
  const authenticated = identities.length > 0;

  async function signOut() {
    setError("");
    setSigningOut(true);
    try {
      if (builtInEmail) {
        const {authClient} = await import("@/client/auth-client");
        const result = await authClient.signOut();
        if (result.error) {
          throw new Error(result.error.message || "Sign out failed");
        }
      }
      window.location.assign(adminLogoutDestination(
        adminPath,
        cloudflareAccessDetected,
      ));
    } catch {
      setSigningOut(false);
      setError("Unable to sign out right now. Please try again.");
      setOpen(true);
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Open account menu"
            className="gap-1 rounded-full pl-2"
            variant="ghost"
          />
        }
      >
        <CircleUserRoundIcon aria-hidden="true" className="size-6" />
        <ChevronDownIcon aria-hidden="true" className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {authenticated ? (
          <>
            <DropdownMenuLabel className="space-y-3 px-2 py-2 font-normal">
              {identities.map((identity) => (
                <span className="block" key={identity.label}>
                  <span className="block text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">
                    {identity.label}
                  </span>
                  <span className="mt-0.5 block truncate text-sm font-medium text-foreground">
                    {identity.value}
                  </span>
                </span>
              ))}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={<a href={adminAccountSettingsDestination(adminPath)} />}
            >
              <SettingsIcon aria-hidden="true" />
              Account settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {error && (
              <div className="mx-1 mb-1 rounded-lg bg-destructive/10 px-2 py-2 text-xs text-destructive" role="alert">
                {error}
              </div>
            )}
            <DropdownMenuItem
              disabled={signingOut}
              onClick={(event) => {
                event.preventDefault();
                void signOut();
              }}
            >
              <LogOutIcon aria-hidden="true" />
              {signingOut ? "Signing out…" : "Sign out"}
            </DropdownMenuItem>
          </>
        ) : (
          <div className="m-1 flex gap-2 rounded-lg border border-warning-color/25 bg-warning-color/10 p-3 text-sm">
            <ShieldAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-color" />
            <span>
              <strong className="block text-foreground">No authentication</strong>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Anyone who knows this dashboard address can open it.
              </span>
            </span>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
