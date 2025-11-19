import type { GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import Head from "next/head";
import CanvasBackground from "~/components/canvas-background";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useState, useMemo } from "react";
import { useToast } from "~/hooks/use-toast";
import { api } from "~/utils/api";
import { isValidEmail } from "~/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) {
    return {
      redirect: { destination: "/login", permanent: false },
    };
  }
  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, session.user.id),
  });
  if (user?.type !== "organizer") {
    return {
      redirect: { destination: "/dashboard", permanent: false },
    };
  }
  return { props: {} };
}

const ALL_STATUSES = [
  "IN_PROGRESS",
  "PENDING_REVIEW",
  "IN_REVIEW",
  "ACCEPTED",
  "REJECTED",
  "WAITLISTED",
  "DECLINED",
] as const;

type Status = (typeof ALL_STATUSES)[number];

export default function AdjustStatus() {
  const [fileName, setFileName] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [status, setStatus] = useState<Status | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [showParsed, setShowParsed] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const { toast } = useToast();

  const uniqueValidEmails = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const e of emails) {
      const trimmed = e.trim().toLowerCase();
      if (!trimmed) continue;
      if (!isValidEmail(trimmed)) continue;
      if (!seen.has(trimmed)) {
        seen.add(trimmed);
        out.push(trimmed);
      }
    }
    return out;
  }, [emails]);

  const mutation = api.application.bulkUpdateStatusByEmails.useMutation();

  function parseCsv(text: string) {
    // Accepts either comma-separated or newline-separated emails
    const parts = text
      .split(/\r?\n|,|;|\t/g)
      .map((p) => p.trim())
      .filter(Boolean);
    setEmails(parts);
  }

  async function handleFileChange(file: File | null) {
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    parseCsv(text);
  }

  function handleAddEmail() {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed) {
      toast({
        title: "Email required",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }
    if (!isValidEmail(trimmed)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }
    setEmails((prev) => [...prev, trimmed]);
    setNewEmail("");
    toast({
      title: "Email added",
      description: `Added ${trimmed} to the list`,
    });
  }

  async function handleSave() {
    if (!status) {
      toast({ title: "Select a status", variant: "destructive" });
      return;
    }
    if (uniqueValidEmails.length === 0) {
      toast({ title: "No valid emails found", variant: "destructive" });
      return;
    }
    setPending(true);
    try {
      const result = await mutation.mutateAsync({
        emails: uniqueValidEmails,
        status,
      });
      toast({
        title: "Statuses updated",
        description: `Matched ${result.matched} emails; updated ${result.updated} applications.`,
      });
      setEmails([]);
      setFileName("");
      setStatus(undefined);
    } catch (err) {
      toast({
        title: "Update failed",
        description: String(err),
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Head>
        <title>Adjust Status | Hack Western</title>
      </Head>
      <div className="m-auto flex min-h-screen flex-col items-center justify-start bg-hw-radial-gradient py-8">
        <CanvasBackground />
        <div className="z-10 w-full max-w-3xl rounded-lg bg-background/90 p-6 shadow-md backdrop-blur-sm">
          <h1 className="mb-2 font-dico text-3xl text-heavy">Adjust Status</h1>
          <p className="mb-6 text-sm text-medium">
            Upload a CSV of emails, select a status, and save. All matched
            applications will be updated in a single transaction.
          </p>

          <div className="mb-6">
            <h2 className="mb-2 font-figtree text-medium">
              Upload CSV of Emails
            </h2>
            <Input
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={(e) =>
                void handleFileChange(e.target.files?.[0] ?? null)
              }
            />
            {fileName && (
              <div className="mt-2 text-sm text-gray-600">{fileName}</div>
            )}
            <div className="mt-2 text-sm">
              Parsed emails: {uniqueValidEmails.length}
              <button
                type="button"
                className="ml-2 inline-flex items-center text-purple-600 hover:text-violet-700"
                onClick={() => setShowParsed((v) => !v)}
                aria-expanded={showParsed}
                aria-controls="parsed-email-list"
                title={showParsed ? "Hide emails" : "Show emails"}
              >
                {showParsed ? "▾" : "▸"}
              </button>
            </div>
            {showParsed && uniqueValidEmails.length > 0 && (
              <div
                id="parsed-email-list"
                className="mt-2 max-h-64 overflow-auto rounded border border-gray-200 bg-white/70 p-3 text-xs text-gray-800"
              >
                <ul className="list-none pl-0">
                  {uniqueValidEmails.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="mb-6">
            <h2 className="mb-2 font-figtree text-medium">
              Add Single Email
            </h2>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Enter email address"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddEmail();
                  }
                }}
                className="flex-1"
              />
              <Button
                variant="primary"
                onClick={handleAddEmail}
                type="button"
              >
                Add
              </Button>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="mb-2 font-figtree text-medium">Select New Status</h2>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as Status)}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Choose status" />
              </SelectTrigger>
              <SelectContent>
                {ALL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3">
            <Button
              variant="primary"
              onClick={() => void handleSave()}
              isPending={pending}
              disabled={pending}
            >
              {pending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
