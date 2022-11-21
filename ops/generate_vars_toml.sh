# Use in CI
if test -f ".vars.toml"; then
    echo ".vars.toml exists."
    exit
fi

cat << EOF > .vars.toml
          CLOUDFLARE_PROJECT_NAME = "$CLOUDFLARE_PROJECT_NAME"
          CLOUDFLARE_ACCOUNT_ID = "$CLOUDFLARE_ACCOUNT_ID"
          CLOUDFLARE_API_TOKEN = "$CLOUDFLARE_API_TOKEN"

          R2_ACCESS_KEY_ID = "$R2_ACCESS_KEY_ID"
          R2_SECRET_ACCESS_KEY = "$R2_SECRET_ACCESS_KEY"
          R2_PUBLIC_BUCKET = "$R2_PUBLIC_BUCKET"
          R2_PRIVATE_BUCKET = "$R2_PRIVATE_BUCKET"
          MEDIA_BASE_URL = "$MEDIA_BASE_URL"

          ADMIN_USERNAME = "$ADMIN_USERNAME"
          ADMIN_PASSWORD = "$ADMIN_PASSWORD"

          PRODUCTION_BRANCH = "$PRODUCTION_BRANCH"

          MICROFEED_VERSION = "v1"
          NODE_VERSION = "17.0"

          DEPLOYMENT_ENVIRONMENT = "$DEPLOYMENT_ENVIRONMENT"
EOF
