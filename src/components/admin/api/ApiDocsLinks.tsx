import {cn} from "@/lib/utils";

export const API_DOC_LINKS = [
  {href: "/api/", label: "Interactive API docs"},
  {href: "/api/openapi.json", label: "OpenAPI JSON"},
  {href: "/api/openapi.yaml", label: "OpenAPI YAML"},
  {href: "/api/llms.txt", label: "llms.txt"},
  {href: "/api/llms-full.txt", label: "llms-full.txt"},
] as const;

export default function ApiDocsLinks({className}: {className?: string}) {
  return (
    <ul
      aria-label="Public API docs formats"
      className={cn("flex flex-wrap gap-x-4 gap-y-1 text-xs", className)}
    >
      {API_DOC_LINKS.map((docsLink) => (
        <li key={docsLink.href}>
          <a
            className="underline underline-offset-4"
            href={docsLink.href}
            rel="noopener noreferrer"
            target="_blank"
          >
            {docsLink.label}
          </a>
        </li>
      ))}
    </ul>
  );
}
