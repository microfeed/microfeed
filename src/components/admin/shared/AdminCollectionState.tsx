import {Button} from "@/components/ui/button";
import {Skeleton} from "@/components/ui/skeleton";

export function AdminCollectionLoading({label}: {label: string}) {
  return (
    <div aria-busy="true" aria-live="polite" role="status">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="grid gap-3">
        {Array.from({length: 6}, (_, index) => (
          <div className="rounded-[14px] border bg-card p-5" key={index}>
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="mt-4 h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminCollectionError({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <section
      className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-destructive/40 bg-destructive/5 p-4"
      role="alert"
    >
      <p className="text-sm text-foreground">{message}</p>
      <Button onClick={retry} type="button" variant="outline">Retry</Button>
    </section>
  );
}
