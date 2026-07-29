import type {AdminProtectionStatus} from "@/types";

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

export function adminProtectionStatus(
  request: Request,
  builtInSessionVerified: boolean,
): AdminProtectionStatus {
  return {
    builtInLogin: builtInSessionVerified,
    cloudflareAccess: cloudflareAccessDetected(request),
  };
}
