# microfeed

[![Deploy to Cloudflare Pages](https://github.com/microfeed/microfeed/actions/workflows/deploy.yml/badge.svg?event=workflow_dispatch)](https://github.com/microfeed/microfeed/actions/workflows/deploy.yml)


> Note: microfeed is in Open Alpha, running on Cloudflare's Open Alpha products (e.g., D1). Therefore, we don't recommend for production data and traffic at this moment.

microfeed allows you to easily create a self-hosted feed on Cloudflare [Pages](https://pages.cloudflare.com/), [R2](https://www.cloudflare.com/products/r2/), [D1](https://developers.cloudflare.com/d1/), and [Zero Trust](https://www.cloudflare.com/products/zero-trust/). 

You can consider microfeed as a very lightweight CMS (Content management system), where you can easily publish audios, videos, photos, documents, blog posts, and any external urls to the feed. 

The feed can be accessed via a customizable website, a rss feed (compatible w/ podcast rss), and a [json feed](https://www.jsonfeed.org/). See it in action:
* Web feed: [https://llamacorn.listennotes.com/](https://llamacorn.listennotes.com/)
* Rss feed: [https://llamacorn.listennotes.com/rss/](https://llamacorn.listennotes.com/rss/)
* Json feed: [https://llamacorn.listennotes.com/json/](https://llamacorn.listennotes.com/json/)

There's a simple but powerful admin dashboard that allows you to easily add items to the feed, upload media files (e.g., audio, video, image, document...) to Cloudflare R2, and customize web page styles. If you've used WordPress before, it's similar. 

There are many use cases of microfeed:
* Self-hosted Podcast: a feed of audios
* Self-hosted Blog: a feed of articles.
* Self-hosted Instagram: a feed of photos. E.g., [llamacorn.listennotes.com/](https://llamacorn.listennotes.com/)
* Self-hosted YouTube: a feed of videos.
* Self-hosted personal website: a custom web page with a feed of any links. E.g., [wenbin.org](https://www.wenbin.org/)
* Self-hosted content curation site: a feed of article links + custom titles + comments, just like [Daring Fireball](https://daringfireball.net/) and [Drudge Report](https://www.drudgereport.com/).
* Self-hosted marketing site: a custom web page with updates / press coverage / changelogs. E.g., [microfeed.org](https://www.microfeed.org/)

We use Cloudflare Pages to host and run the code, use R2 to host and serve media files, use D1 to store metadata, and use Zero Trust to provide login to the admin dashboard. Cloudflare provides very generous free usage quota. For personal or small-business-level usage, it's unlikely that you need to pay Cloudflare. In other words, you use microfeed + Cloudflare for free hosting!

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

You may modify the code in your forked repo in the future. But most likely, you won't need to touch the code at all. Just fork the repo and [sync fork](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/syncing-a-fork) in the future.

### Step 2: Put some secrets on your forked repo

Go to your forked repo's [Settings -> Secrets -> Actions](../../settings/secrets/actions), and create these secrets:


<details>
  <summary>CLOUDFLARE_ACCOUNT_ID</summary>

You can get your cloudflare account id from your dashboard's url:
  
After you [login your Cloudflare account](https://dash.cloudflare.com/login?lang=en-US), you'll be redirected to a url like this
```
https://dash.cloudflare.com/[your-cloudflare-account-id-here]
```
The last part of the url is your cloudflare account id.  
</details>

<details>
  <summary>CLOUDFLARE_API_TOKEN</summary>

You'll need to create an API token here: [https://dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)
  
Create a custom token:
  
<img width="925" alt="Screenshot 2022-12-04 at 4 30 57 PM" src="https://user-images.githubusercontent.com/1719237/205525627-14da54ae-1733-4db5-b65d-94f5ec48f360.png">

We need edit permission for both Cloudflare Pages and D1:
  
<img width="990" alt="Screenshot 2022-12-04 at 4 31 41 PM" src="https://user-images.githubusercontent.com/1719237/205525675-4c8a6bce-21a8-45e3-bf0c-28981f123da3.png">
  
Finally, copy the API token here:
  
<img width="682" alt="Screenshot 2022-12-04 at 4 34 01 PM" src="https://user-images.githubusercontent.com/1719237/205525785-6fed8e49-7342-4b36-9d07-348e1c28cbcc.png">

  
  </details>
  
<details>
  <summary>R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY</summary>
  
Go to your [R2 dashboard page](https://dash.cloudflare.com/sign-up/r2). You may need to put your credit card there first. You won't need to pay, unless your usage exceeds the very generous free quota limit (i.e., 10GB storage + 10 million reads/month + 1 million writes/month).
  
Create an R2 API token here:
  
  <img width="1328" alt="Screenshot 2022-12-04 at 4 43 58 PM" src="https://user-images.githubusercontent.com/1719237/205526381-cc11d4fe-b053-49d0-9072-de54db31b3b7.png">
  
Select "Edit" permission and create an API token:
  
  <img width="849" alt="Screenshot 2022-12-04 at 4 45 18 PM" src="https://user-images.githubusercontent.com/1719237/205526491-79a87e1e-02e0-4268-9f88-7d9cdc6b3b68.png">

Copy Access Key ID for R2_ACCESS_KEY_ID, and Secret Access Key for R2_SECRET_ACCESS_KEY
  <img width="728" alt="Screenshot 2022-12-04 at 4 45 35 PM" src="https://user-images.githubusercontent.com/1719237/205526582-92f440ac-21c4-46d9-a065-cfc1937391c8.png">


</details>


<details>
  <summary>CLOUDFLARE_PROJECT_NAME</summary>
  
A legit project name should have these characters: [a-z], [A-Z], [0-9], and -

We recommend using the custom domain name that you'll use for this project and replace dot (.) with dash (-)
  
For example, if you use photos.mycustomdomain.com, then the project name should be photos-mycustomdomain-com
  
Note: Don't use underscore (_), space ( ), and other characters outside [a-z], [A-Z], [0-9] and -. Or Cloudflare Pages won't let you create a project.
</details>

In total, you'll add 5 secrets for GitHub Actions:

<img width="826" alt="Screenshot 2022-12-04 at 4 10 46 PM" src="https://user-images.githubusercontent.com/1719237/205524410-268abf92-af61-467a-8883-78b8d4de3c56.png">


### Step 3: Run GitHub Action to deploy code

Go to [Actions -> Deploy to Cloudflare Pages](../../actions/workflows/deploy.yml) and run Workflow

<img width="1606" alt="Screenshot 2022-12-04 at 4 11 19 PM" src="https://user-images.githubusercontent.com/1719237/205526856-05ea0ff4-703a-4d08-bc7f-4ae2dfc07cfe.png">

If you see the green checkmark, then the deployment is successful. And you can see a Pages project in your [Cloudflare dashboard](https://dash.cloudflare.com/sign-up/pages):


<img width="880" alt="Screenshot 2022-12-04 at 4 55 10 PM" src="https://user-images.githubusercontent.com/1719237/205527141-277620dd-586b-42dd-be97-edb7875d0705.png">

You can access the site via ${CLOUDFLARE_PROJECT_NAME}.pages.dev, for example, [https://microfeed-org.pages.dev/](https://microfeed-org.pages.dev/)

### Step 4: Make a few clicks on Cloudflare dashboard

To manage your site, you'll use the admin dashboard at ${CLOUDFLARE_PROJECT_NAME}.pages.dev/admin

The first time you access the admin dashboard, you'll follow the checklist to finish up setup:
* R2 Public Bucket URL
* Add a login to the admin dashboard
* Custom Domain
