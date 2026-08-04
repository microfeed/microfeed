import type {AdminProtectionStatus} from "@/types";

export interface CloudflareAccessIdentity {
  detected: boolean;
  email?: string;
}

function looksLikeJwt(value: string | null): boolean {
  if (!value) {
    return false;
  }
  const segments = value.trim().split(".");
  return segments.length === 3 && segments.every(Boolean);
}

export function cloudflareAccessDetected(request: Request): boolean {
  // Cloudflare Access adds this signed application token after authentication.
  // This status is informational; Access remains responsible for enforcing its
  // policy before the request reaches the Worker.
  return looksLikeJwt(
    request.headers.get("cf-access-jwt-assertion"),
  );
}

function accessEmailFromJwt(value: string): string | undefined {
  try {
    const payload = value.split(".")[1];
    if (!payload) return undefined;
    const normalized = payload.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(
      normalized.length + (4 - normalized.length % 4) % 4,
      "=",
    );
    const claims = JSON.parse(atob(padded)) as {
      email?: unknown;
      type?: unknown;
    };
    if (claims.type !== "app" || typeof claims.email !== "string") {
      return undefined;
    }
    const email = claims.email.trim();
    return email || undefined;
  } catch {
    return undefined;
  }
}

export function cloudflareAccessIdentity(
  request: Request,
): CloudflareAccessIdentity {
  const assertion = request.headers.get("cf-access-jwt-assertion")?.trim() ?? "";
  if (!looksLikeJwt(assertion)) {
    return {detected: false};
  }
  return {
    detected: true,
    email: accessEmailFromJwt(assertion),
  };
}

export function adminProtectionStatus(
  request: Request,
  builtInSessionVerified: boolean,
): AdminProtectionStatus {
  return {
    builtInLogin: builtInSessionVerified,
    cloudflareAccess: cloudflareAccessIdentity(request).detected,
  };
}
