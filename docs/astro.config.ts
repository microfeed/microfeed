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
            { label: "Themes, access, and custom code", link: "/dashboard/customize/" },
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
            { label: "Enable access and create keys", link: "/api/authentication/" },
            { label: "Build and test integrations", link: "/api/build-and-test/" },
            { label: "Use the API with AI agents", link: "/api/ai-agents/" },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "yarn manage command reference", link: "/manage-cli/" },
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
            "microfeed is an open-source, self-hosted CMS that publishes one collection as a website, RSS feed, and JSON feed from Cloudflare.",
          details:
            "Use the Installation guides for deployment workflows. Use the yarn manage reference for exact command behavior and safety rules.",
          promote: ["index", "start-here/**", "manage-cli"],
          demote: ["contribute/**"],
          customSets: [
            {
              label: "Deploy and operate microfeed",
              description:
                "The practical deployment, maintenance, troubleshooting, and command reference for a microfeed instance.",
              paths: ["start-here/**", "manage/**", "manage-cli"],
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
