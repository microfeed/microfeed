import sitemap from "@astrojs/sitemap";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightLlmsTxt from "starlight-llms-txt";

export default defineConfig({
  site: "https://docs.microfeed.org",
  integrations: [
    starlight({
      title: "microfeed docs",
      description:
        "Deploy, publish, customize, and maintain a self-hosted microfeed site on Cloudflare.",
      logo: {
        light: "./src/assets/microfeed-logo.png",
        dark: "./src/assets/microfeed-logo-dark.png",
        alt: "microfeed by Listen Notes",
        replacesTitle: true,
      },
      favicon:
        "https://media-cdn.microfeed.org/production/images/favicon-99ed35713d5dad0bb07a4255ec6d73b2.png",
      customCss: ["./src/styles/custom.css"],
      head: [
        {
          tag: "script",
          attrs: {
            src: "https://buttons.github.io/buttons.js",
            async: true,
            defer: true,
          },
        },
      ],
      components: {
        PageTitle: "./src/components/PageTitle.astro",
        SocialIcons: "./src/components/GitHubRepoButtons.astro",
      },
      editLink: {
        baseUrl: "https://github.com/microfeed/microfeed/edit/main/docs/",
      },
      lastUpdated: true,
      pagination: true,
      markdown: {
        processedDirs: ["."],
      },
      sidebar: [
        { label: "Home", link: "/" },
        {
          label: "Installation",
          items: [
            { label: "Quick start", link: "/start-here/" },
            { label: "How microfeed works", link: "/start-here/concepts/" },
            { label: "Deploy with an AI agent", link: "/start-here/ai-agent/" },
            { label: "Deploy manually", link: "/start-here/manual/" },
            { label: "After deployment", link: "/start-here/after-deploy/" },
          ],
        },
        {
          label: "Dashboard",
          items: [
            { label: "Dashboard tour", link: "/dashboard/" },
            { label: "Create and edit items", link: "/dashboard/publish/" },
            { label: "Edit channel", link: "/dashboard/edit-channel/" },
            { label: "Media and feeds", link: "/dashboard/media-and-feeds/" },
            { label: "Themes and website code", link: "/dashboard/themes/" },
            { label: "Pages, search, and Site Files", link: "/dashboard/pages-search-and-site-files/" },
            { label: "Site access", link: "/dashboard/customize/" },
          ],
        },
        {
          label: "Theme development",
          items: [
            { label: "Build and release a theme", link: "/themes/" },
            { label: "Theme contract and rendering", link: "/themes/contract/" },
            { label: "Bundle CSS, JavaScript, and assets", link: "/themes/assets/" },
          ],
        },
        {
          label: "Manage your site",
          items: [
            { label: "Overview", link: "/manage/" },
            { label: "Update microfeed", link: "/manage/update/" },
            { label: "Domains and authentication", link: "/manage/domains-and-access/" },
            { label: "Multiple instances", link: "/manage/multiple-instances/" },
            { label: "Snapshots and migrations", link: "/manage/backups-and-migrations/" },
            { label: "Status and troubleshooting", link: "/manage/troubleshooting/" },
            { label: "Remove a site safely", link: "/manage/remove/" },
          ],
        },
        {
          label: "API and integrations",
          items: [
            { label: "API overview", link: "/api/" },
            { label: "Bearer authentication", link: "/api/authentication/" },
            { label: "Build an API integration", link: "/api/build-and-test/" },
          ],
        },
        {
          label: "Webhooks and integrations",
          items: [
            { label: "Webhooks overview", link: "/webhooks/" },
            { label: "Build webhook endpoints", link: "/webhooks/endpoints/" },
            { label: "Operate and troubleshoot webhooks", link: "/webhooks/operations/" },
          ],
        },
        {
          label: "Content automation",
          items: [
            { label: "Content automation overview", link: "/automation/" },
            {
              label: "Connect automation platforms",
              items: [
                { label: "Connect microfeed to n8n", link: "/automation/platforms/n8n/" },
                { label: "Connect microfeed to Zapier", link: "/automation/platforms/zapier/" },
              ],
            },
            {
              label: "@microfeed/cli and AI agents",
              items: [
                { label: "Manage content with @microfeed/cli", link: "/automation/cli/" },
                { label: "Manage content with AI agents", link: "/automation/ai-agents/" },
              ],
            },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "yarn manage reference", link: "/manage-cli/" },
            { label: "@microfeed/cli reference", link: "/microfeed-cli/" },
            { label: "@microfeed/theme-kit reference", link: "/theme-kit-cli/" },
            { label: "Glossary", link: "/reference/glossary/" },
          ],
        },
        {
          label: "Contribute",
          items: [
            { label: "Contributing", link: "/contribute/" },
          ],
        },
      ],
      plugins: [
        starlightLlmsTxt({
          projectName: "microfeed",
          description:
            "microfeed is an open-source CMS that publishes one collection as a website, RSS feed, and JSON Feed from the owner's Cloudflare account.",
          details:
            "Use the Installation guides for deployment workflows. Use the yarn manage reference for site-management commands and the @microfeed/cli reference for content commands and safety rules.",
          promote: ["index", "start-here/**", "manage-cli", "microfeed-cli", "theme-kit-cli"],
          demote: ["contribute/**"],
          customSets: [
            {
              label: "Deploy and operate microfeed",
              description:
                "The practical deployment, maintenance, troubleshooting, and command reference for a microfeed instance.",
              paths: ["start-here/**", "manage/**", "manage-cli"],
            },
            {
              label: "Build with the microfeed API",
              description:
                "The REST API overview, Bearer authentication guide, and integration workflow for a microfeed instance.",
              paths: ["api/index", "api/authentication", "api/build-and-test"],
            },
            {
              label: "Manage content with @microfeed/cli and AI agents",
              description:
                "The guided CLI workflow, AI-agent conventions, and complete content-management command reference.",
              paths: ["automation/cli", "automation/ai-agents", "microfeed-cli"],
            },
            {
              label: "Build content automations and integrations",
              description:
                "Choose APIs, webhooks, or the CLI; connect n8n and Zapier; build secure webhook endpoints; and operate production automations.",
              paths: ["automation/**", "webhooks/**", "api/index", "api/authentication", "microfeed-cli"],
            },
            {
              label: "Build microfeed themes",
              description:
                "Customize an installed theme, develop standalone theme packages, understand the render contract, and bundle browser assets.",
              paths: ["dashboard/themes", "themes/**", "theme-kit-cli", "manage-cli"],
            },
          ],
          optionalLinks: [
            {
              label: "Source repository",
              url: "https://github.com/microfeed/microfeed",
              description: "Source code, issues, and contribution history.",
            },
          ],
        }),
      ],
    }),
    sitemap(),
  ],
});
