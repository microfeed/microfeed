export function projectPrefix(env) {
  const projectName = env.CLOUDFLARE_PROJECT_NAME || 'microfeed';
  const deploymentEnvironment = env.DEPLOYMENT_ENVIRONMENT || 'production';
  return `${projectName}/${deploymentEnvironment}`;
}
