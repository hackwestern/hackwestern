import type { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ClipboardEvent } from "react";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { useToast } from "~/hooks/use-toast";
import { api } from "~/utils/api";
import { useAutoSave } from "~/hooks/use-auto-save";
import { linksSaveSchema } from "~/schemas/application";
import {
  getGithubUsername,
  getLinkedinUsername,
  ensureUrlHasProtocol,
} from "~/utils/urls";

export function LinksForm() {
  const utils = api.useUtils();
  const { data: defaultValues } = api.application.get.useQuery({
    fields: ["status", "githubLink", "linkedInLink", "otherLink", "resumeLink"],
  });
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [resumeName, setResumeName] = useState<string | null>(null);

  const status = defaultValues?.status ?? "NOT_STARTED";
  const canEdit = status == "NOT_STARTED" || status == "IN_PROGRESS";

  // If the application already has a resumeLink when the component mounts,
  // derive a display name from the URL so the original filename shows.
  useEffect(() => {
    if (!resumeName && defaultValues?.resumeLink) {
      try {
        setResumeName(fileNameFromUrl(defaultValues.resumeLink));
      } catch {
        /* ignore */
      }
    }
  }, [defaultValues?.resumeLink, resumeName]);

  const { mutate } = api.application.save.useMutation({
    onSuccess: () => {
      return utils.application.get.invalidate();
    },
  });

  const form = useForm<z.infer<typeof linksSaveSchema>>({
    resolver: zodResolver(linksSaveSchema),
  });

  const FIELDS: Array<keyof z.infer<typeof linksSaveSchema>> = [
    "githubLink",
    "linkedInLink",
    "otherLink",
    "resumeLink",
  ];

  useAutoSave(form, onSubmit, defaultValues, { fields: FIELDS });

  function onSubmit(data: z.infer<typeof linksSaveSchema>) {
    // Normalize resume and other links so they validate as URLs (prepend https:// if missing)
    const normalizedData = {
      ...data,
      resumeLink: ensureUrlHasProtocol(data.resumeLink),
      otherLink: ensureUrlHasProtocol(data.otherLink),
    } as z.infer<typeof linksSaveSchema>;

    mutate({
      ...normalizedData,
      fields: FIELDS,
    });
  }

  function onGithubPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text");
    const githubUsername = getGithubUsername(pastedText);

    form.setValue("githubLink", githubUsername);
    return form.handleSubmit(onSubmit)();
  }

  function onLinkedinPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text");
    const linkedinUsername = getLinkedinUsername(pastedText);

    form.setValue("linkedInLink", linkedinUsername);
    return form.handleSubmit(onSubmit)();
  }

  function fileNameFromUrl(url: string) {
    try {
      const u = new URL(url);
      const last = u.pathname.split("/").filter(Boolean).pop();
      return last ?? url;
    } catch {
      const parts = url.split("/");
      return parts[parts.length - 1] ?? url;
    }
  }

  async function onResumeFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max size is 3 MB" });
      e.target.value = "";
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      const resp = await fetch("/api/upload/resume", {
        method: "POST",
        body: formData,
      });
      if (!resp.ok) {
        const { message } = (await resp.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(message ?? `Upload failed (${resp.status})`);
      }
      const data = (await resp.json()) as {
        url: string;
        name: string;
      };
      // Set the resume link to the uploaded URL and autosave
      form.setValue("resumeLink", data.url, { shouldDirty: true });
      setResumeName(data.name);
      await form.handleSubmit(onSubmit)();
      toast({ title: "Uploaded", description: "Resume uploaded successfully" });
    } catch (err) {
      console.error(err);
      toast({ title: "Upload error", description: (err as Error).message });
    } finally {
      setUploading(false);
    }
  }

  function clearResume() {
    form.setValue("resumeLink", "", { shouldDirty: true });
    setResumeName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    void form.handleSubmit(onSubmit)();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="githubLink"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Github</FormLabel>
              <FormControl>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>github.com/</span>
                  <Input
                    onPaste={onGithubPaste}
                    {...field}
                    value={field.value ?? ""}
                    placeholder="hacker"
                    variant="primary"
                    disabled={!canEdit}
                  />
                </div>
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="linkedInLink"
          render={({ field }) => (
            <FormItem>
              <FormLabel>LinkedIn</FormLabel>
              <FormControl>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="w-32">linkedin.com/in/</span>
                  <Input
                    onPaste={onLinkedinPaste}
                    {...field}
                    value={field.value ?? ""}
                    placeholder="hacker"
                    variant="primary"
                    disabled={!canEdit}
                  />
                </div>
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="otherLink"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Personal Portfolio</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  placeholder="hackerportfolio.com"
                  variant="primary"
                  disabled={!canEdit}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="resumeLink"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Resume</FormLabel>
              <FormControl>
                <div className="flex flex-col gap-2">
                  {field.value ? (
                    <div className="flex items-center gap-2 text-sm">
                      <a
                        href={field.value}
                        target="_blank"
                        rel="noreferrer"
                        className="max-w-64 overflow-hidden text-ellipsis whitespace-nowrap underline underline-offset-2"
                      >
                        {resumeName ?? fileNameFromUrl(field.value)}
                      </a>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={clearResume}
                          className="text-xl text-muted-foreground hover:text-foreground"
                          aria-label="Remove resume"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={onResumeFileChange}
                        disabled={!canEdit || uploading}
                        className="hidden"
                      />
                      <div className="flex items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={!canEdit || uploading}
                          aria-label="Choose resume file"
                          className="-py-4 px-2"
                        >
                          <span className="text-medium">
                            {uploading ? "Uploading…" : "Choose file"}
                          </span>
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          PDF or DOC/DOCX, max 3 MB
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </FormControl>
              <FormDescription>Upload your resume</FormDescription>
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
