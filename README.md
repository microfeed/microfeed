# microfeed: a lightweight cms self-hosted on cloudflare

[<img src="https://user-images.githubusercontent.com/1719237/207514210-99ddbd03-f8f0-410a-96c8-80da1afb804d.png" width=400 alt="microfeed: a lightweight self-hosted CMS on Cloudflare" />](https://www.microfeed.org/)

[![Deploy to Cloudflare Pages](https://github.com/microfeed/microfeed/actions/workflows/deploy.yml/badge.svg?event=workflow_dispatch)](https://github.com/microfeed/microfeed/actions/workflows/deploy.yml)
[![Email us](https://img.shields.io/badge/Email-support%40microfeed.org-blue)](mailto:support@microfeed.org)
[![stability-alpha](https://img.shields.io/badge/stability-alpha-f4d03f.svg)](https://www.microfeed.org/i/introducing-microfeed-self-hosted-cms-on-cloudflare-opensource-serverless-free-uhbQEmArlC2/)

Welcome to microfeed, a lightweight content management system (CMS) self-hosted on Cloudflare.
With microfeed, you can easily publish a variety of content such as audios, videos, photos, documents, blog posts,
and external URLs to a feed in the form of web, RSS, and JSON. It's the perfect solution for tech-savvy individuals who
want to self-host their own CMS without having to run their own servers.

microfeed is built by [Listen Notes](https://www.listennotes.com/) and is hosted on Cloudflare's [Pages](https://pages.cloudflare.com/),
[R2](https://www.cloudflare.com/products/r2/), [D1](https://developers.cloudflare.com/d1/), and [Zero Trust](https://www.cloudflare.com/products/zero-trust/).

If you have any questions or feedback, please don't hesitate to reach out to us at support@microfeed.org. We'd love to hear from you!

**Table of contents**
<!-- TOC -->
* [microfeed: a lightweight cms self-hosted on cloudflare](#microfeed--a-lightweight-cms-self-hosted-on-cloudflare)
  * [How it works](#how-it-works)
  * [Installation](#installation)
    * [Prerequisites](#prerequisites)
    * [Step 1. Fork the microfeed repo to your GitHub](#step-1-fork-the-microfeed-repo-to-your-github)
    * [Step 2. Put some secrets on your forked repo](#step-2-put-some-secrets-on-your-forked-repo)
    * [Step 3. Run GitHub Action to deploy code](#step-3-run-github-action-to-deploy-code)
    * [Step 4. Make a few clicks on Cloudflare dashboard](#step-4-make-a-few-clicks-on-cloudflare-dashboard)
    * [Step 5. Done. Start publishing!](#step-5-done-start-publishing-)
    * [Bonus. Update to the latest version of microfeed](#bonus-update-to-the-latest-version-of-microfeed)
  * [FAQs](#faqs)
  * [Contributions](#contributions)
    * [Run microfeed on local](#run-microfeed-on-local)
  * [License](#license)
<!-- TOC -->

## How it works

Since the 1990s, a significant portion of the web has been powered by feeds.
People (and bots) publish items to a feed, and others can subscribe to that feed to receive new content.

microfeed makes it easy for individuals to self-host their own feed on Cloudflare, including but not limited to
* a podcast feed of audios
* a blog feed of posts
* an Instagram-like feed of images (e.g., [llamacorn.listennotes.com](https://llamacorn.listennotes.com/))
* a YouTube-like feed of videos
* a personal website with custom links (e.g., [wenbin.org](https://www.wenbin.org/))
* a content curation feed of external urls
* a marketing site with updates and press coverage (e.g., [microfeed.org](https://www.microfeed.org/))
* ...

microfeed uses Cloudflare [Pages](https://pages.cloudflare.com/) to host and run the code,
[R2](https://www.cloudflare.com/products/r2/) to host and serve media files,
[D1](https://developers.cloudflare.com/d1/) to store metadata,
and [Zero Trust](https://www.cloudflare.com/products/zero-trust/) to provide logins to the admin dashboard.
Cloudflare provides very generous free usage quotas, making it an affordable solution for personal or small business use.
While you will still need to pay for a domain name, hosting microfeed on Cloudflare is essentially free.

With microfeed, you can publish a variety of content such as audios, videos, photos, documents, blog posts,
and external URLs to a customizable website, an RSS feed, and a [JSON feed](https://www.jsonfeed.org/).
Check out some examples of microfeed in action:
* Web feed: [https://llamacorn.listennotes.com/](https://llamacorn.listennotes.com/)
* Rss feed: [https://llamacorn.listennotes.com/rss/](https://llamacorn.listennotes.com/rss/)
* Json feed: [https://llamacorn.listennotes.com/json/](https://llamacorn.listennotes.com/json/)

microfeed provides a simple yet powerful admin dashboard that makes it easy to add items to the feed,
upload media files, and customize web page styles. If you've used WordPress before, you'll find it familiar.

![image-6d056193c81c0b8f5de0503f5af18116](https://user-images.githubusercontent.com/1719237/209486588-00acefe0-dd51-4bfc-aed7-1f63850aa720.png)


## Installation

Roughly you'll follow these steps to install a microfeed instance to Cloudflare:

1. Fork the [microfeed repo](https://github.com/microfeed/microfeed) to your personal (or organizational) GitHub account.
2. Obtain Cloudflare API tokens and save them as secrets on your forked GitHub repository.
3. Use the predefined GitHub Action in your forked repository to deploy the code to Cloudflare Pages, using the secrets from step 2.
4. Make a few clicks on Cloudflare's dashboard to set up custom domains and configure some security settings.
5. Done. Start publishing!

> We understand that not everyone is comfortable with reading documentation, so we've made it as easy as possible
> to get started with microfeed. However, we'd love to see Cloudflare implement a "Login with Cloudflare" OAuth feature,
> which would allow for almost one-click deployment of microfeed. In the meantime, we've tried to make the setup process
> as straightforward as possible for tech-savvy users.


### Prerequisites

* Have a Cloudflare account. If you don't have one already, you can [sign up for free at Cloudflare.com](https://dash.cloudflare.com/sign-up).
* Have a GitHub account. If you don't have one, you can [sign up for free at GitHub.com](https://github.com/signup).

### Step 1. Fork the microfeed repo to your GitHub

Simply click on [https://github.com/microfeed/microfeed/fork](https://github.com/microfeed/microfeed/fork) to fork the repository.

You may choose to modify the code in your forked repository in the future, but it's likely that you won't need to
touch the code at all. Simply fork the repository and keep it synced for future use.

### Step 2. Put some secrets on your forked repo

Go to your forked repo's [Settings -> Secrets -> Actions](../../settings/secrets/actions), and create 5 secrets (click for more details).
With these secrets in place, you'll be able to use GitHub Actions to deploy your microfeed instance to Cloudflare Pages.

<details>
  <summary><b>CLOUDFLARE_ACCOUNT_ID</b></summary>

You can get your cloudflare account id from your dashboard's url:

After you [login your Cloudflare account](https://dash.cloudflare.com/login?lang=en-US), you'll be redirected to a url like this
```
https://dash.cloudflare.com/[your-cloudflare-account-id-here]
```
The last part of the url is your cloudflare account id.

For example, if you see a url like this:
```
https://dash.cloudflare.com/fff88980eeeeedcc3ffffd4f555f4999
```

Then you'll set **CLOUDFLARE_ACCOUNT_ID** to **fff88980eeeeedcc3ffffd4f555f4999**:

<img width="846" alt="Screenshot 2022-12-17 at 10 31 10 AM" src="https://user-images.githubusercontent.com/1719237/208216752-56f00f51-29cb-43ea-b720-75244719898d.png">
</details>

<details>
  <summary><b>CLOUDFLARE_API_TOKEN</b></summary>

You'll need to create an API token here: [https://dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)

Create a custom token:

<img width="925" alt="Screenshot 2022-12-04 at 4 30 57 PM" src="https://user-images.githubusercontent.com/1719237/205525627-14da54ae-1733-4db5-b65d-94f5ec48f360.png">

We need edit permission for both Cloudflare Pages and D1:

<img width="990" alt="Screenshot 2022-12-04 at 4 31 41 PM" src="https://user-images.githubusercontent.com/1719237/205525675-4c8a6bce-21a8-45e3-bf0c-28981f123da3.png">

Finally, copy the API token here:

<img width="682" alt="Screenshot 2022-12-04 at 4 34 01 PM" src="https://user-images.githubusercontent.com/1719237/205525785-6fed8e49-7342-4b36-9d07-348e1c28cbcc.png">


  </details>

<details>
  <summary><b>R2_ACCESS_KEY_ID</b> and <b>R2_SECRET_ACCESS_KEY</b></summary>

Go to your [R2 dashboard page](https://dash.cloudflare.com/sign-up/r2). You may need to put your credit card there first. You won't need to pay, unless your usage exceeds the very generous free quota limit (i.e., 10GB storage + 10 million reads/month + 1 million writes/month).

Create an R2 API token here:

  <img width="1328" alt="Screenshot 2022-12-04 at 4 43 58 PM" src="https://user-images.githubusercontent.com/1719237/205526381-cc11d4fe-b053-49d0-9072-de54db31b3b7.png">

Select "Edit" permission and create an API token:

  <img width="849" alt="Screenshot 2022-12-04 at 4 45 18 PM" src="https://user-images.githubusercontent.com/1719237/205526491-79a87e1e-02e0-4268-9f88-7d9cdc6b3b68.png">

Copy Access Key ID for R2_ACCESS_KEY_ID, and Secret Access Key for R2_SECRET_ACCESS_KEY
  <img width="728" alt="Screenshot 2022-12-04 at 4 45 35 PM" src="https://user-images.githubusercontent.com/1719237/205526582-92f440ac-21c4-46d9-a065-cfc1937391c8.png">


</details>


<details>
  <summary><b>CLOUDFLARE_PROJECT_NAME</b></summary>

A legit project name should have these characters: [a-z], [A-Z], [0-9], and -

We recommend using the custom domain name that you'll use for this project and replace dot (.) with dash (-)

For example, if you use photos.mycustomdomain.com, then the project name should be photos-mycustomdomain-com

Note: Don't use underscore (_), space ( ), and other characters outside [a-z], [A-Z], [0-9] and -. Or Cloudflare Pages won't let you create a project.
</details>

In total, you'll add 5 secrets for GitHub Actions:

<img width="826" alt="Screenshot 2022-12-04 at 4 10 46 PM" src="https://user-images.githubusercontent.com/1719237/205524410-268abf92-af61-467a-8883-78b8d4de3c56.png">


### Step 3. Run GitHub Action to deploy code

Go to [Actions -> Deploy to Cloudflare Pages](../../actions/workflows/deploy.yml) and run Workflow

<img width="1606" alt="Screenshot 2022-12-04 at 4 11 19 PM" src="https://user-images.githubusercontent.com/1719237/205526856-05ea0ff4-703a-4d08-bc7f-4ae2dfc07cfe.png">

If you see the green checkmark, then the deployment is successful. And you can see a Pages project in your [Cloudflare dashboard](https://dash.cloudflare.com/sign-up/pages):


<img width="880" alt="Screenshot 2022-12-04 at 4 55 10 PM" src="https://user-images.githubusercontent.com/1719237/205527141-277620dd-586b-42dd-be97-edb7875d0705.png">

You can access the site via ${CLOUDFLARE_PROJECT_NAME}.pages.dev, for example, [https://microfeed-org.pages.dev/](https://microfeed-org.pages.dev/)

### Step 4. Make a few clicks on Cloudflare dashboard

To manage your microfeed instance, you'll use the admin dashboard at ${CLOUDFLARE_PROJECT_NAME}.pages.dev/admin, for example, [https://microfeed-org.pages.dev/admin/](https://microfeed-org.pages.dev/admin/) (the admin dashboard needs to be protected by Cloudflare Zero Trust).

Upon accessing the admin dashboard for the first time, you'll complete the setup process by following the checklist:

<img width="1182" alt="Screenshot 2022-12-17 at 10 34 05 AM" src="https://user-images.githubusercontent.com/1719237/208216864-38a65086-77ef-4595-bc05-c87be2676e6d.png">

### Step 5. Done. Start publishing!

Once you've completed the setup process, your microfeed instance will be ready to use.
You can add, update, or delete items from the admin dashboard.

You can also customize the appearance of the website at Settings / Custom code by editing the raw HTML and CSS:

<img width="1098" alt="Screenshot 2022-12-30 at 7 57 45 PM" src="https://user-images.githubusercontent.com/1719237/210062910-e56135f6-557e-419e-a00d-b25dd391c93d.png">

The HTML code is using [mustache.js](https://github.com/janl/mustache.js) as a templating language, where you can access to variables from Feed Json or Item Json. For example, on our marketing website [microfeed.org](https://www.microfeed.org/)'s home page (Feed Web), we use variables in the html code from [microfeed.org/json/](https://www.microfeed.org/json/), and on [an item's page](https://www.microfeed.org/i/introducing-microfeed-a-self-hosted-open-source-cms-on-cloudflare-open-alpha-uhbQEmArlC2/) (Item Web), we use variables from [${item_url}/json](https://www.microfeed.org/i/introducing-microfeed-a-self-hosted-open-source-cms-on-cloudflare-open-alpha-uhbQEmArlC2/json).

With the easy access to the json data of a microfeed instance (i.e., [Feed Json](https://www.microfeed.org/json/) and [Item Json](https://www.microfeed.org/i/introducing-microfeed-a-self-hosted-open-source-cms-on-cloudflare-open-alpha-uhbQEmArlC2/json), you can use it as a headless CMS and build your own client apps to display the content. 


### Bonus. Update to the latest version of microfeed

We'll continue to add new features and fix bugs in this microfeed repo.
You may want to update your forked repo with the new code.

You'll first sync up the code in your forked repo:

<img width="488" alt="Screenshot 2022-12-26 at 7 58 32 AM" src="https://user-images.githubusercontent.com/1719237/209483973-c82e7808-0d21-4aad-ac2d-c4e80da691bc.png">

Then go to [Actions -> Deploy to Cloudflare Pages](../../actions/workflows/deploy.yml) and run Workflow to deploy the new code.



## FAQs

<details>
<summary><b>How can I track podcast / video / image downloads?</b></summary>

To track podcast, video, or image downloads with microfeed, you can use the tracking URLs feature.
This allows you to set up third-party tracking URLs for your media files, such as those provided by Podtrac or Chartable.

To set up tracking URLs, you will need to go to Settings / Tracking URLs:
<img width="1101" alt="Screenshot 2022-12-17 at 10 19 50 AM" src="https://user-images.githubusercontent.com/1719237/208216098-1c8ab8df-eeae-4e50-96c8-4347911ee281.png">

From there, you can add the third-party tracking URLs that you want to use.
microfeed will automatically add these URLs to the front of the URL for your media files, allowing you to track download statistics.

This is a [common practice in the podcast industry](https://lowerstreet.co/blog/podcast-tracking) and can be a useful way to monitor the performance of your content and understand how it is being consumed by your audience.

</details>

<details>
<summary><b>Why Cloudflare? Isn't it dangerous to trust a for-profit company?</b></summary>

Many individuals and organizations trust and use Cloudflare's services because it has a reputation for providing reliable and effective services.
We ([Listen Notes](https://www.listennotes.com/)) have been using Cloudflare for many years.

It's convenient to manage all things on a one-stop platform like Cloudflare (e.g., DNS, Cache, firewall, running code, CDN, trustless logins...).

microfeed is still in open alpha phase. Cloudflare is the first platform we support.
We may consider supporting other serverless platforms, so you can easily migrate away if needed.
</details>


<details>
<summary><b>What if Cloudflare de-platforms my microfeed instance?</b></summary>

It is important to carefully review the terms of service for any service that you use, including Cloudflare.
It is possible that if you violate the terms of service, the service may take action, such as de-platforming your instance.

To protect against the possibility of being de-platformed, it is a good idea to regularly backup your data from Cloudflare.
This will allow you to recover your contents and potentially migrate them to a different platform if necessary.
It is also a good idea to use your own custom domain, as this will give you more control over your content and make it easier to move your data to a different platform if needed.
</details>


<details>
<summary><b>Why should I use microfeed?</b></summary>

If you are already using Cloudflare and are satisfied with its services, then using microfeed may be a good option for you.

If you don't want to manage your own servers, microfeed can be a convenient alternative that allows you to take advantage of
Cloudflare's infrastructure and security features.

If you don't want to pay for servers, microfeed can be a cost-effective solution, as Cloudflare provides generous free usage quotas.

If you are looking for something new and are interested in exploring different options, microfeed could be a good choice to consider.
It is always a good idea to carefully evaluate any service before using it to ensure that it meets your needs and is a good fit for your use case.
</details>

## Contributions
We welcome contributions to microfeed!
If you have an idea for a new feature or have found a bug, please [open an issue](https://github.com/microfeed/microfeed/issues/new) in the repository.
If you'd like to submit a fix or new feature, please create a pull request with a detailed description of your changes.

### Run microfeed on local

First, create a .vars.toml file in microfeed's root directory (same level as this README.md file) and put 5 secrets in the .vars.toml file (Similar to [Step 2. Put some secrets on your forked repo](#step-2-put-some-secrets-on-your-forked-repo)):
```toml
# .vars.toml
CLOUDFLARE_PROJECT_NAME = "your-project-org"
CLOUDFLARE_ACCOUNT_ID = "account id"
CLOUDFLARE_API_TOKEN = 'api token'

R2_ACCESS_KEY_ID = "access key"
R2_SECRET_ACCESS_KEY = "secret key"
```

Second, run local dev server:
```bash
npm run dev
```

You should be able to access to a local microfeed instance via http://127.0.0.1:8788/.

## License
microfeed is licensed under the [AGPL-3.0](https://github.com/microfeed/microfeed/blob/main/LICENSE) license. Please see [the LICENSE file](https://github.com/microfeed/microfeed/blob/main/LICENSE) for more information.
