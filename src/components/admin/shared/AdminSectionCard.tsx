import type {ReactNode} from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {cn} from "@/lib/utils";

export default function AdminSectionCard({
  action,
  children,
  className,
  description,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  description: ReactNode;
  title: ReactNode;
}) {
  return (
    <Card className={cn("gap-0 py-0", className)}>
      <CardHeader className="gap-3 border-b p-5">
        {action ? (
          <div className="flex items-start justify-between gap-4">
            <div className="grid min-w-0 gap-3">
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            <div className="shrink-0">{action}</div>
          </div>
        ) : (
          <>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </>
        )}
      </CardHeader>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
}
