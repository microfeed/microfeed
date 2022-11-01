# Listen Host

## Prerequisites

Create a .*.vars file in root directory of this project - same level as package.json.
* .dev.vars
* .production.vars
* .preview.vars

Put all environment variables in ```.dev.vars``` and overwrite some variables in ```.production.vars``` for production,
and ```.preview.vars``` for preview.

Supported environment variables are:
```
PROJECT_NAME = "pages-project-name"
ACCOUNT_ID = ""

R2_ACCESS_KEY_ID = ""
R2_SECRET_ACCESS_KEY = ""
R2_BUCKET = "bucket-name"
MEDIA_BASE_URL = "https://bucket-name.your-custom-domain.com"

PAGES_SECRET_ACCESS_KEY = ""

CUSTOM_DOMAINS = "custom-domain1.com,custom-domain2.com,custom-domain3.com"
ADMIN_USERNAME = ""
ADMIN_PASSWORD = ""

NODE_VERSION = "17.0"
```

## Bind R2 Bucket to Pages

Go to page -> settings -> functions then add R2 binding for LH_DATABASE
