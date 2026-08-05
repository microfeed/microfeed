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
  children,
  className,
  description,
  title,
}: {
  children: ReactNode;
  className?: string;
  description: ReactNode;
  title: ReactNode;
}) {
  return (
    <Card className={cn("gap-0 py-0", className)}>
      <CardHeader className="gap-3 border-b p-5">
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
}
