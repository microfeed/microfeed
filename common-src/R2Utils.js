export function projectPrefix(env) {
  return `${env.CLOUDFLARE_PROJECT_NAME}/${env.DEPLOYMENT_ENVIRONMENT}`;
}
