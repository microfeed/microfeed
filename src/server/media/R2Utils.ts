import {isLocalDevelopmentHostname} from "@/shared/StringUtils";

type DeploymentEnvironmentBindings = Pick<Env, "DEPLOYMENT_ENVIRONMENT">;

export function deploymentEnvironment(
  env: DeploymentEnvironmentBindings,
  requestUrl?: string,
): "development" | "preview" | "production" {
  if (
    requestUrl &&
    isLocalDevelopmentHostname(new URL(requestUrl).hostname)
  ) {
    return "development";
  }
  return env.DEPLOYMENT_ENVIRONMENT ?? "production";
}

export function mediaPrefix(
  env: DeploymentEnvironmentBindings,
  requestUrl?: string,
): "development" | "preview" | "production" {
  return deploymentEnvironment(env, requestUrl);
}
