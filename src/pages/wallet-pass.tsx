import { useState } from "react";
import { useSession, signIn } from "next-auth/react";
// import {
//   GenericClient,
//   GenericClass,
//   GenericObject
// } from "google-wallet/lib/cjs/generic";
// This library could be used for later to streamline pass generation...
import Head from "next/head";
import WalletButton from "../components/WalletButton";
import { api } from "~/utils/api";

interface ApiWalletResponse {
  saveToWalletUrl?: string;
  message?: string; // For errors or other info
  error?: string; // Explicit error message
}

const WalletPassPage = () => {
  const { data: session, status } = useSession();
  const [saveToWalletUrl, setSaveToWalletUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Replace fetch with TRPC mutation
  const { mutate: createPass, isLoading } = api.wallet.createPass.useMutation({
    onSuccess: (data) => {
      console.log("CLIENT: API Response Data:", data);
      if (data.saveToWalletUrl) {
        console.log("CLIENT: Setting saveToWalletUrl:", data.saveToWalletUrl);
        setSaveToWalletUrl(data.saveToWalletUrl);
      } else {
        console.error("CLIENT: Failed to get saveToWalletUrl from API.", data);
        setError(
          data.error ||
            data.message ||
            "Failed to generate pass. No URL received from API."
        );
        setSaveToWalletUrl(""); // Ensure it's cleared on error
      }
    },
    onError: (err) => {
      console.error("CLIENT: Error in createPass mutation:", err);
      setError(err.message || "An unexpected error occurred during API call.");
      setSaveToWalletUrl(""); // Ensure it's cleared on error
    }
  });

  const handleGeneratePass = async () => {
    setError("");
    setSaveToWalletUrl(""); // Explicitly clear previous URL at the start
    createPass();
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading session...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
        <Head>
          <title>Access Denied | HackWestern Pass</title>
        </Head>
        <h1 className="mb-4 text-2xl font-semibold">Access Denied</h1>
        <p className="mb-6">
          Please sign in to generate your HackWestern digital pass.
        </p>
        <button
          onClick={() => signIn()}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Sign In
        </button>
      </div>
    );
  }

  // Note for developers: The JWT 'origins' claim, configured in the backend API
  // (via NEXT_PUBLIC_APP_URL), must match the domain where this Next.js page is hosted
  // for the "Add to Google Wallet" button to function correctly.
  return (
    <>
      <Head>
        <title>Your HackWestern Digital Pass</title>
        <meta
          name="description"
          content="Generate your personalized HackWestern Google Wallet pass."
        />
      </Head>
      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="mb-6 text-3xl font-bold">
            Your HackWestern Digital Pass
          </h1>

          {saveToWalletUrl ? (
            <div className="mt-8 flex flex-col items-center">
              <p className="mb-6 text-lg text-gray-700 dark:text-gray-300">
                Your pass is ready! Click the button below to add it to your
                Google Wallet.
              </p>
              <WalletButton saveToWalletUrl={saveToWalletUrl} />
              <button
                onClick={() => {
                  setSaveToWalletUrl(null); // Allow generating a new pass
                  setError(null); // Clear previous errors
                }}
                className="mt-6 rounded border border-gray-300 px-4 py-2 hover:bg-gray-50"
              >
                Generate New Pass
              </button>
            </div>
          ) : (
            <>
              <p className="mb-8 text-lg text-gray-700 dark:text-gray-300">
                Get your personalized digital pass for HackWestern! Click the
                button below to generate your pass.
              </p>
              <button
                onClick={handleGeneratePass}
                disabled={isLoading}
                className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? "Generating..." : "Generate My Wallet Pass"}
              </button>
            </>
          )}

          {error && (
            <div className="mt-6 rounded-md border border-red-300 bg-red-100 p-4 text-red-700">
              <p className="font-semibold">Error:</p>
              <p>{error}</p>
            </div>
          )}

          {!isLoading && !saveToWalletUrl && !error && (
            <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-6 text-left shadow-sm dark:border-blue-700 dark:bg-blue-900/20">
              <p className="text-blue-700 dark:text-blue-300">
                Click the "Generate My Wallet Pass" button to get started.
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
};

export default WalletPassPage;
