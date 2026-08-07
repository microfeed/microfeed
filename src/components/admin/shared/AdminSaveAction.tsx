import {Button} from "@/components/ui/button";
import type {
  AutosavePhase,
  AutosaveState,
} from "@/client/AutosaveCoordinator";

interface Props extends AutosaveState {
  buttonLabel?: string;
  idleMessage?: string;
}

const STATUS_TEXT: Record<Exclude<AutosavePhase, "idle">, string> = {
  error: "Couldn’t save. Your changes are still on this page.",
  pending: "Unsaved changes",
  saved: "All changes saved",
  saving: "Saving…",
};

export default function AdminSaveAction({
  buttonLabel = "Save now",
  dirty,
  idleMessage = "Changes save automatically after five seconds.",
  phase,
}: Props) {
  const message = phase === "idle" ? idleMessage : STATUS_TEXT[phase];
  const failed = phase === "error";
  const saving = phase === "saving";

  return (
    <div className="rounded-[14px] border bg-card p-5 text-center text-card-foreground shadow-xs">
      <p
        aria-live="polite"
        className={failed
          ? "text-sm text-destructive"
          : "text-sm text-muted-foreground"}
      >
        {message}
      </p>
      <Button
        className="mt-3 w-full"
        disabled={!dirty || saving}
        size="lg"
        type="submit"
      >
        {failed ? "Retry save" : buttonLabel}
      </Button>
    </div>
  );
}
