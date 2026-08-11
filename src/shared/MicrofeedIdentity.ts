import {MICROFEED_VERSION} from "./Version";

export interface MicrofeedIdentity {
  applicationVersion: string;
  deployedAt: string;
  instanceId: string;
  oauthAuthorizationAvailable: boolean;
  product: "microfeed";
}

export function microfeedIdentity(
  instanceId: string,
  deployedAt: string,
  oauthAuthorizationAvailable: boolean,
): MicrofeedIdentity {
  return {
    applicationVersion: MICROFEED_VERSION,
    deployedAt,
    instanceId,
    oauthAuthorizationAvailable,
    product: "microfeed",
  };
}
