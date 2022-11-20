# FeedKit

[![Deploy to Cloudflare Pages](https://github.com/ListenNotes/FeedKit/actions/workflows/deploy.yml/badge.svg?event=workflow_dispatch)](https://github.com/ListenNotes/FeedKit/actions/workflows/deploy.yml)

FeedKit allows you to easily create a self-hosted feed on [Cloudflare Pages](https://pages.cloudflare.com/) and [R2](https://www.cloudflare.com/products/r2/).

The self-hosted feed can publish audios, videos, photos, documents, blog posts, and any external urls. FeedKit provides a website, an RSS, and a JSON under your own cusdom domain and custom UI design.

There are many use cases of FeedKit. Basically, you can use FeedKit create a self-hosted version of:
* Podcast: a feed of audios
* Blog: a feed of texts
* Instagram: a feed of photos
* YouTube: a feed of videos
* Personal website: a simple web page with a feed of any links. E.g., [wenbin.org](https://www.wenbin.org/)
* Curation site: a feed of article links

Cloudflare Pages is a serverless platform to build websites. We use Cloudflare Pages to host and run the code.

Cloudflare R2 is a storage for media files like images, audios, and videos. We use R2 to host and serve media files.

Cloudflare provides very generous free usage quota. For personal or small-business-level usage, it's unlikely that you need to pay Cloudflare. In other words, you use FeedKit + Cloudflare for free hosting!

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

* CLOUDFLARE_ACCOUNT_ID
* CLOUDFLARE_API_TOKEN
* CLOUDFLARE_PROJECT_NAME
* R2_ACCESS_KEY_ID
* R2_SECRET_ACCESS_KEY
* ADMIN_PASSWORD (optional)
* ADMIN_USERNAME (optional)
* R2_PUBLIC_BUCKET (optional)
* R2_PRIVATE_BUCKET (optional)
* MEDIA_BASE_URL (optional)
* PRODUCTION_BRANCH (optional)

### Step 3: Run GitHub Action to deploy code

Go to [Actions -> Deploy to Cloudflare Pages](../../actions) and run Workflow

<img width="1655" alt="Screenshot 2022-11-17 at 9 44 41 PM" src="https://user-images.githubusercontent.com/1719237/202629665-a55c3b99-4b33-4908-9b0a-cbdd6abebf25.png">

You should choose "production" + "setup" when it's the first time you run the GitHub Actions Workflow. Later on, when you need to deploy new code, you can choose "deploy" + "preview"/"production" to deploy to different environments.

### Step 4: Make a few clicks on Cloudflare dashboard

#### Make the public R2 bucket public

todo

#### Setup authentication for the admin dashboard and preview sites

We don't want people to see preview sites (please ignore the warning "the zone does not exist"):
<img width="1124" alt="Screenshot 2022-11-18 at 9 05 02 PM" src="https://user-images.githubusercontent.com/1719237/202835250-197c4711-2bf4-47fd-9c44-5559e15699f6.png">

We don't want anyone on the Internet to access our Admin dashboard. So let's require email login (please ignore the warning "the zone does not exist"):
<img width="1140" alt="Screenshot 2022-11-18 at 9 04 24 PM" src="https://user-images.githubusercontent.com/1719237/202835245-ded62810-493e-42ea-8f13-2cb6508f0c19.png">

If you use custom domain, you'd better do protect admin for the custom domain as well:

<img width="1111" alt="Screenshot 2022-11-18 at 9 21 35 PM" src="https://user-images.githubusercontent.com/1719237/202835735-abb24f0f-ea69-4d21-82a5-48a25bc99944.png">


#### Setup custom domains
