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
            { label: "Pages and Site Files", link: "/dashboard/pages-search-and-site-files/" },
            { label: "Site access", link: "/dashboard/customize/" },
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
            { label: "Build and test integrations", link: "/api/build-and-test/" },
          ],
        },
        {
          label: "Content automation",
          items: [
            { label: "Content automation overview", link: "/automation/" },
            { label: "Set up and test an automation", link: "/automation/setup-and-test/" },
            { label: "Build webhook-driven AI agents", link: "/automation/ai-agents/" },
            { label: "Automation recipes", link: "/automation/recipes/" },
            { label: "Operate and troubleshoot", link: "/automation/operations/" },
          ],
        },
        {
          label: "@microfeed/cli and AI agents",
          items: [
            { label: "Manage content with @microfeed/cli", link: "/api/cli/" },
            { label: "Manage content with AI agents", link: "/api/ai-agents/" },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "yarn manage command reference", link: "/manage-cli/" },
            { label: "microfeed cli reference", link: "/microfeed-cli/" },
            { label: "theme-kit cli reference", link: "/theme-kit-cli/" },
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
            "Use the Installation guides for deployment workflows. Use the yarn manage reference for site-management commands and the microfeed CLI reference for content commands and safety rules.",
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
              paths: ["api/cli", "api/ai-agents", "microfeed-cli"],
            },
            {
              label: "Automate microfeed content with webhooks and AI agents",
              description:
                "Webhook setup, secure agent receiver patterns, runnable automation recipes, and production operations.",
              paths: ["automation/**", "api/index", "api/authentication", "microfeed-cli"],
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
