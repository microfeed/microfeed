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
import type {AdminSidebarData} from "./admin-shell-types";

interface Props {
  sidebar: AdminSidebarData;
}

export default function AdminMobileNavigation({sidebar}: Props) {
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
        <AdminSidebar
          data={sidebar}
          onNavigate={() => setNavigationOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
