import { DashboardButton } from "~/components/internals/dashboard-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

interface JudgeConfirmProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  /** Called for Cancel, Escape and a tap outside the dialog. */
  onCancel: () => void;
}

/** A confirmation dialog, used instead of the browser's own confirm box. */
export function JudgeConfirm({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: JudgeConfirmProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent className="max-w-[calc(100vw-2.5rem)] font-figtree sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-col-reverse sm:space-x-0">
          <DashboardButton
            type="button"
            variant="outline"
            onClick={onCancel}
            className="min-h-11 md:w-full"
          >
            {cancelLabel}
          </DashboardButton>
          <DashboardButton
            type="button"
            onClick={onConfirm}
            className="min-h-11 md:w-full"
          >
            {confirmLabel}
          </DashboardButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}