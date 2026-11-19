import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { isDuringHackathon } from "~/lib/date";

const PHRASE = "i understand";
const STORAGE_KEY = "internal-warning-acknowledged";

// Shown on every internal page, from a week before the hackathon through the event, until
// the viewer types the phrase once (remembered in this browser).
export function InternalWarning() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  // Checked after mount so it follows the viewer's clock and storage.
  useEffect(() => {
    if (!isDuringHackathon()) return;
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      // Storage blocked: fall through and show the warning.
    }
    setOpen(true);
  }, []);

  const confirmed = text.trim().toLowerCase() === PHRASE;

  const acknowledge = () => {
    if (!confirmed) return;
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Not persisted; it will ask again next visit.
    }
    setOpen(false);
  };

  return (
    // Not dismissable by clicking outside or Esc; must type the phrase.
    <Dialog open={open}>
      <DialogContent
        className="font-figtree [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            acknowledge();
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TriangleAlert className="h-5 w-5 text-amber-600" />
              Careful: internal tools
            </DialogTitle>
            <DialogDescription>
              Only touch things here if you know what you&apos;re doing, or a
              member of the web team told you to. Changes here affect the live
              event.
            </DialogDescription>
          </DialogHeader>
          <label className="grid gap-1 text-sm">
            Type &quot;I understand&quot; to continue
            <Input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="I understand"
            />
          </label>
          <DialogFooter>
            <Button type="submit" variant="primary" disabled={!confirmed}>
              Continue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
