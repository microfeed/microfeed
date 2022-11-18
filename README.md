# FeedKit

[![Deploy to Cloudflare Pages](https://github.com/ListenNotes/FeedKit/actions/workflows/deploy.yml/badge.svg?event=workflow_dispatch)](https://github.com/ListenNotes/FeedKit/actions/workflows/deploy.yml)

## Install FeedKit to Cloudflare Pages

Roughly you'll do these steps:

1. Fork FeedKit repo to your own GitHub.
2. Get Cloudflare API tokens and save them as secrets on your forked GitHub repo.
3. Run the predefined GitHub Action in your forked GitHub repo to deploy code to Cloudflare Pages, which needs to use those secrets on Step 2.
4. Make a few clicks on Cloudflare's dashboard to setup custom domains and some security stuffs.
5. Profit!

### Prerequisites 

* You need to have a Cloudflare account. If you don't, please [sign up on Cloudflare.com](https://dash.cloudflare.com/sign-up) for free.
* You'd better have a GitHub account. If you don't, please [sign up on GitHub.com](https://github.com/signup) for free.

### Step 1: Fork FeedKit repo to your GitHub

Click on [https://github.com/ListenNotes/FeedKit/fork](https://github.com/ListenNotes/FeedKit/fork) to fork the FeedKit repo.

You may modify the code in your forked repo in the future. But most likely, you won't need to touch the code at all.

### Step 2: Put some secrets on your forked repo

Go to your forked repo's Settings -> Secrets -> Actions:

<img width="1143" alt="Screenshot 2022-11-17 at 9 33 28 PM" src="https://user-images.githubusercontent.com/1719237/202628319-4f615748-1404-4649-8d97-8ad93c517f14.png">

You'll need to create these secrets:

* ADMIN_PASSWORD
* ADMIN_USERNAME
* CLOUDFLARE_ACCOUNT_ID
* CLOUDFLARE_API_TOKEN
* CLOUDFLARE_PROJECT_NAME
* MEDIA_BASE_URL
* R2_ACCESS_KEY_ID
* R2_BUCKET
* R2_SECRET_ACCESS_KEY

### Step 3: Run GitHub Action to deploy code

Go to Actions -> Deploy to Cloudflare Pages and run Workflow

<img width="1655" alt="Screenshot 2022-11-17 at 9 44 41 PM" src="https://user-images.githubusercontent.com/1719237/202629665-a55c3b99-4b33-4908-9b0a-cbdd6abebf25.png">

You should choose "production" + "setup" when it's the first time you run the GitHub Actions Workflow. Later on, when you need to deploy new code, you can choose "deploy" + "preview"/"production" to deploy to different environments. 
