"use client";

import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import jsQR from "jsqr";
import { TRPCClientError } from "@trpc/client";
import { api, type RouterOutputs } from "~/utils/api";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { cn } from "~/lib/utils";
import { authRedirectOrganizer } from "~/utils/redirect";

type ProjectStatus = RouterOutputs["checkIn"]["getProjectStatus"];
type Result =
  | { kind: "status"; data: ProjectStatus }
  | { kind: "error"; message: string };

// Hardware return: scan a hacker's badge to see whether their team submitted
// a project. The last result stays on screen until the next scan.
const ProjectCheckPage = () => {
  const router = useRouter();
  const utils = api.useUtils();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busyRef = useRef(false);
  // The camera keeps running, so ignore the same QR for a few seconds
  const lastScanRef = useRef<{ value: string; at: number } | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const startCamera = async () => {
    try {
      setCameraError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          window.location.protocol === "https:"
            ? "Camera API not available. Please use a modern browser."
            : "Camera requires HTTPS.",
        );
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // back camera on phones
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener("loadedmetadata", () =>
          setCameraActive(true),
        );
      }
    } catch (error) {
      setCameraActive(false);
      setCameraError(
        error instanceof Error ? error.message : "Unable to access camera",
      );
    }
  };

  useEffect(() => {
    void startCamera();
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const readFrame = (): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!video || !canvas || !ctx) return null;
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return (
      jsQR(image.data, image.width, image.height, {
        inversionAttempts: "dontInvert",
      })?.data ?? null
    );
  };

  const check = async (qrData: string) => {
    const last = lastScanRef.current;
    if (busyRef.current) return;
    if (last && last.value === qrData && Date.now() - last.at < 3000) return;
    lastScanRef.current = { value: qrData, at: Date.now() };
    busyRef.current = true;
    setChecking(true);

    // Same parsing as the activity scanner: JSON with userId/id, or plain text
    let userId = qrData;
    try {
      const parsed = JSON.parse(qrData) as { userId?: string; id?: string };
      userId = parsed.userId ?? parsed.id ?? qrData;
    } catch {
      // plain hacker ID or user id
    }

    try {
      const data = await utils.checkIn.getProjectStatus.fetch(
        { userId },
        { staleTime: 0 },
      );
      setResult({ kind: "status", data });
    } catch (error) {
      setResult({
        kind: "error",
        message:
          error instanceof TRPCClientError
            ? error.message
            : "Couldn't check this code. Try again.",
      });
    } finally {
      setChecking(false);
      busyRef.current = false;
    }
  };

  useEffect(() => {
    if (!cameraActive) return;
    const id = setInterval(() => {
      const qr = readFrame();
      if (qr) void check(qr);
    }, 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraActive]);

  return (
    <div className="flex h-dvh w-full flex-col bg-dashboard-bg-nav font-figtree">
      <header className="flex flex-col items-start gap-2 px-6 pb-5 pt-5">
        <DashboardButton
          variant="tertiary"
          className="font-semibold text-dashboard-text-heavy md:text-[16px]"
          onClick={() => void router.push("/scavenger")}
        >
          <ArrowLeft />
          Back
        </DashboardButton>
        <h1 className="text-[28px] font-bold leading-[1.2] text-dashboard-text-heavy">
          Hardware return
        </h1>
        <p className="text-sm font-medium text-dashboard-text-medium">
          Scan a hacker&apos;s badge to check their team submitted a project.
        </p>
      </header>

      <div className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden rounded-t-[10px] border border-dashboard-border-subtle bg-dashboard-bg-surface">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            "absolute inset-0 h-full w-full object-cover",
            cameraActive ? "opacity-100" : "opacity-0",
          )}
        />
        <canvas ref={canvasRef} className="hidden" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="aspect-square w-[70%] max-w-[260px] border-2 border-white" />
        </div>
        {!cameraActive && cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-dashboard-bg-inset p-6">
            <p className="text-center text-base font-medium text-dashboard-text-medium">
              {cameraError}
            </p>
            <DashboardButton onClick={() => void startCamera()}>
              Start Camera
            </DashboardButton>
          </div>
        )}
      </div>

      <ResultCard result={result} checking={checking} />
    </div>
  );
};

const ResultCard = ({
  result,
  checking,
}: {
  result: Result | null;
  checking: boolean;
}) => {
  if (!result) {
    return (
      <section className="bg-dashboard-bg-surface px-6 py-5 text-base font-medium text-dashboard-text-medium">
        {checking ? "Checking…" : "Waiting for a scan."}
      </section>
    );
  }

  if (result.kind === "error") {
    return (
      <section
        aria-live="polite"
        className="flex flex-col gap-1 bg-red-50 px-6 py-5 text-red-800"
      >
        <p className="text-xl font-bold">Couldn&apos;t check</p>
        <p className="text-base font-medium">{result.message}</p>
      </section>
    );
  }

  const { name, submitted, team } = result.data;
  return (
    <section
      aria-live="polite"
      className={cn(
        "flex flex-col gap-1 px-6 py-5",
        submitted
          ? "bg-green-50 text-dashboard-status-live"
          : "bg-red-50 text-red-800",
        checking && "opacity-60",
      )}
    >
      <p className="text-2xl font-bold">
        {submitted ? "✓ Project submitted" : "✗ No submitted project"}
      </p>
      <p className="text-lg font-semibold text-dashboard-text-heavy">{name}</p>
      <p className="text-base font-medium text-dashboard-text-medium">
        {!team
          ? "Not on a team."
          : submitted
            ? `Team: ${team.name}`
            : `Team “${team.name}” hasn't submitted.`}
      </p>
      {submitted && team?.devpostUrl && (
        <a
          href={team.devpostUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-base font-semibold text-dashboard-action-primary underline"
        >
          Open on Devpost
        </a>
      )}
    </section>
  );
};

export default ProjectCheckPage;

// Organizers only. Everyone else is sent away, signed in or not.
export const getServerSideProps = authRedirectOrganizer;
