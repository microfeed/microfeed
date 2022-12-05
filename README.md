# microfeed

[![Deploy to Cloudflare Pages](https://github.com/microfeed/microfeed/actions/workflows/deploy.yml/badge.svg?event=workflow_dispatch)](https://github.com/microfeed/microfeed/actions/workflows/deploy.yml)

Note: microfeed is in Open Alpha, running on Cloudflare's Open Alpha products (e.g., D1). Therefore, we don't recommend for production data and traffic at this moment.

microfeed allows you to easily create a self-hosted feed on Cloudflare [Pages](https://pages.cloudflare.com/), [R2](https://www.cloudflare.com/products/r2/), [D1](https://developers.cloudflare.com/d1/), and [Zero Trust](https://www.cloudflare.com/products/zero-trust/).

You can publish audios, videos, photos, documents, blog posts, and any external urls to the feed. It's a very lightweight CMS (Content management system).

There are many use cases of microfeed:
* Self-hosted Podcast: a feed of audios
* Self-hosted Blog: a feed of articles.
* Self-hosted Instagram: a feed of photos. E.g., [llamacorn.listennotes.com/](https://llamacorn.listennotes.com/)
* Self-hosted YouTube: a feed of videos.
* Self-hosted personal website: a custom web page with a feed of any links. E.g., [wenbin.org](https://www.wenbin.org/)
* Self-hosted content curation site: a feed of article links + custom titles + comments, just like [Daring Fireball](https://daringfireball.net/) and [Drudge Report](https://www.drudgereport.com/).
* Self-hosted marketing site: a custom web page with updates / press coverage / changelogs. E.g., [microfeed.org](https://www.microfeed.org/)

Cloudflare Pages is a serverless platform to build websites. We use Cloudflare Pages to host and run the code.

Cloudflare R2 is a storage for media files like images, audios, and videos. We use R2 to host and serve media files.

Cloudflare D1 is a SQLite database. We use D1 to store metadata.

Cloudflare Zero Trust is a set of tools to do access control. We use Zero Trust to provide login to the admin dashboard.

Cloudflare provides very generous free usage quota. For personal or small-business-level usage, it's unlikely that you need to pay Cloudflare. In other words, you use microfeed + Cloudflare for free hosting!

## Install microfeed to Cloudflare Pages

Roughly you'll do these steps:

1. Fork microfeed repo to your personal (or organizational) GitHub account.
2. Get Cloudflare API tokens and save them as secrets on your forked GitHub repo.
3. Run the predefined GitHub Action in your forked GitHub repo to deploy code to Cloudflare Pages, which needs to use those secrets on Step 2.
4. Make a few clicks on Cloudflare's dashboard to setup custom domains and some security stuffs.
5. Profit!


Feature request to Cloudflare: Please build a "Login with Cloudflare" OAuth! This will allow microfeed to do (almost) one-click deployment :) Otherwise, people need to read documentation and follow instructions to get an instance of microfeed up and running. Most people don't read documentation. 

### Prerequisites

* You need to have a Cloudflare account. If you don't, please [sign up on Cloudflare.com](https://dash.cloudflare.com/sign-up) for free.
* You'd better have a GitHub account. If you don't, please [sign up on GitHub.com](https://github.com/signup) for free.

### Step 1: Fork microfeed repo to your GitHub

Click on [https://github.com/microfeed/microfeed/fork](https://github.com/microfeed/microfeed/fork) to fork the microfeed repo.

You may modify the code in your forked repo in the future. But most likely, you won't need to touch the code at all.

### Step 2: Put some secrets on your forked repo

Go to your forked repo's [Settings -> Secrets -> Actions](../../settings/secrets/actions):

<img width="1143" alt="Screenshot 2022-11-17 at 9 33 28 PM" src="https://user-images.githubusercontent.com/1719237/202628319-4f615748-1404-4649-8d97-8ad93c517f14.png">

You'll need to create these secrets:

* CLOUDFLARE_ACCOUNT_ID
* CLOUDFLARE_API_TOKEN
* CLOUDFLARE_PROJECT_NAME
* R2_ACCESS_KEY_ID
* R2_SECRET_ACCESS_KEY
* R2_PUBLIC_BUCKET (optional, if you are not sure, then just ignore this one)

### Step 3: Run GitHub Action to deploy code

Go to [Actions -> Deploy to Cloudflare Pages](../../actions/workflows/deploy.yml) and run Workflow

<img width="1655" alt="Screenshot 2022-11-17 at 9 44 41 PM" src="https://user-images.githubusercontent.com/1719237/202629665-a55c3b99-4b33-4908-9b0a-cbdd6abebf25.png">

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
