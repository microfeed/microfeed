import {MICROFEED_VERSION} from "./Version";

export interface MicrofeedIdentity {
  applicationVersion: string;
  deployedAt: string;
  instanceId: string;
  product: "microfeed";
}

export function microfeedIdentity(
  instanceId: string,
  deployedAt: string,
): MicrofeedIdentity {
  return {
    applicationVersion: MICROFEED_VERSION,
    deployedAt,
    instanceId,
    product: "microfeed",
  };
}
