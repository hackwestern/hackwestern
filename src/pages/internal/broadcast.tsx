import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { fromEasternInput, toEasternInput } from "~/lib/broadcast";
import { api } from "~/utils/api";
import { authRedirectOrganizer } from "~/utils/redirect";

const SCHEDULE_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1JRfqib3Mqp2iriKS3rxZBbQyGpZovkagBwEEbcopJCM/edit";

type Form = {
  hackingStartsAt: string;
  hackingEndsAt: string;
  photoSeconds: string;
  videoSeconds: string;
};

const BroadcastAdmin = () => {
  const utils = api.useUtils();
  const settings = api.broadcast.settings.useQuery();
  const save = api.broadcast.updateSettings.useMutation({
    onSuccess: () => utils.broadcast.settings.invalidate(),
  });
  const [form, setForm] = useState<Form | null>(null);

  // Fill the form once, when the saved settings first load.
  useEffect(() => {
    if (settings.data && !form) {
      setForm({
        hackingStartsAt: toEasternInput(settings.data.hackingStartsAt),
        hackingEndsAt: toEasternInput(settings.data.hackingEndsAt),
        photoSeconds: String(settings.data.photoSeconds),
        videoSeconds: String(settings.data.videoSeconds),
      });
    }
  }, [settings.data, form]);

  const update =
    (field: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => {
      save.reset();
      setForm((f) => f && { ...f, [field]: e.target.value });
    };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    save.mutate({
      hackingStartsAt: fromEasternInput(form.hackingStartsAt),
      hackingEndsAt: fromEasternInput(form.hackingEndsAt),
      photoSeconds: Number(form.photoSeconds),
      videoSeconds: Number(form.videoSeconds),
    });
  };

  const savedAt = settings.data?.updatedAt;
  const zodError = save.error?.data?.zodError;
  const saveError = zodError
    ? (Object.values(zodError.fieldErrors).flat()[0] ?? zodError.formErrors[0])
    : save.error?.message;

  return (
    <div className="min-h-screen bg-primary-100 px-4 py-8 font-figtree text-heavy">
      <Head>
        <title>Broadcast settings | Hack Western 13</title>
      </Head>
      <div className="mx-auto max-w-lg">
        <h1 className="mb-2 text-3xl font-semibold">Broadcast settings</h1>
        <p className="mb-6 text-medium">
          Controls the venue display at{" "}
          <Link href="/broadcast" target="_blank" className="underline">
            /broadcast
          </Link>
          . Now and next come from the{" "}
          <a
            href={SCHEDULE_SHEET_URL}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Events schedule sheet
          </a>
          , so change times there.
        </p>

        {settings.isError && (
          <p className="text-red-600">
            Couldn’t load the settings. Refresh the page.
          </p>
        )}

        {form && (
          <form
            onSubmit={onSubmit}
            className="space-y-5 rounded-lg bg-offwhite p-5 shadow-md"
          >
            <div className="space-y-2">
              <Label htmlFor="start">Hacking starts (Eastern)</Label>
              <Input
                id="start"
                type="datetime-local"
                value={form.hackingStartsAt}
                onChange={update("hackingStartsAt")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">Submissions close (Eastern)</Label>
              <Input
                id="end"
                type="datetime-local"
                value={form.hackingEndsAt}
                onChange={update("hackingEndsAt")}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="photo">Photo seconds</Label>
                <Input
                  id="photo"
                  type="number"
                  min={3}
                  max={120}
                  value={form.photoSeconds}
                  onChange={update("photoSeconds")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="video">Video seconds</Label>
                <Input
                  id="video"
                  type="number"
                  min={3}
                  max={300}
                  value={form.videoSeconds}
                  onChange={update("videoSeconds")}
                />
              </div>
            </div>

            <Button type="submit" full disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save settings"}
            </Button>

            <p role="status" className="text-sm text-medium">
              {save.isError
                ? `Not saved: ${saveError}`
                : save.isSuccess
                  ? "Saved. The display updates within 15 seconds."
                  : savedAt
                    ? `Last saved ${savedAt.toLocaleString("en-CA", { timeZone: "America/Toronto", dateStyle: "medium", timeStyle: "short" })} ET`
                    : "Not saved yet. The display shows defaults."}
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

export default BroadcastAdmin;

export const getServerSideProps = authRedirectOrganizer;
