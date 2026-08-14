import {useState} from "react";
import {MenuIcon} from "lucide-react";

import {Button} from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import AdminSidebar from "./AdminSidebar";
import AdminSettingsSidebar from "./settings/AdminSettingsSidebar";
import AdminApiSidebar from "./api/AdminApiSidebar";
import AdminAccountSidebar from "./account/AdminAccountSidebar";
import AdminWebhookSidebar from "./webhooks/AdminWebhookSidebar";
import type {
  AdminAccountSidebarData,
  AdminApiSidebarData,
  AdminSettingsSidebarData,
  AdminSidebarData,
  AdminWebhookSidebarData,
} from "./admin-shell-types";

interface Props {
  accountSidebar?: AdminAccountSidebarData;
  apiSidebar?: AdminApiSidebarData;
  settingsSidebar?: AdminSettingsSidebarData;
  sidebar: AdminSidebarData;
  webhookSidebar?: AdminWebhookSidebarData;
}

export default function AdminMobileNavigation({accountSidebar, apiSidebar, settingsSidebar, sidebar, webhookSidebar}: Props) {
  const [navigationOpen, setNavigationOpen] = useState(false);

  return (
    <Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
      <SheetTrigger
        render={
          <Button
            aria-label="Open admin navigation"
            className="shrink-0 lg:hidden"
            size="icon"
            variant="ghost"
          />
        }
      >
        <MenuIcon aria-hidden="true" />
      </SheetTrigger>
      <SheetContent className="p-0" side="left" showCloseButton={false}>
        <SheetTitle className="sr-only">Admin navigation</SheetTitle>
        <SheetDescription className="sr-only">
          Navigate between microfeed dashboard pages.
        </SheetDescription>
        {accountSidebar ? (
          <AdminAccountSidebar
            data={accountSidebar}
            onNavigate={() => setNavigationOpen(false)}
          />
        ) : apiSidebar ? (
          <AdminApiSidebar
            data={apiSidebar}
            onNavigate={() => setNavigationOpen(false)}
          />
        ) : webhookSidebar ? (
          <AdminWebhookSidebar
            data={webhookSidebar}
            onNavigate={() => setNavigationOpen(false)}
          />
        ) : settingsSidebar ? (
          <AdminSettingsSidebar
            data={settingsSidebar}
            onNavigate={() => setNavigationOpen(false)}
          />
        ) : (
          <AdminSidebar
            data={sidebar}
            onNavigate={() => setNavigationOpen(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
