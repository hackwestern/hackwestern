import { useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
// import {
//   GenericClient,
//   GenericClass,
//   GenericObject
// } from "google-wallet/lib/cjs/generic";
// This library could be used for later to streamline pass generation...
import Head from 'next/head';
import WalletButton from '../components/WalletButton';


interface ApiWalletResponse {
  saveToWalletUrl?: string;
  message?: string; // For errors or other info
  error?: string; // Explicit error message
}

const WalletPassPage = () => {
  const { data: session, status } = useSession();
  const [saveToWalletUrl, setSaveToWalletUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGeneratePass = async () => {
    setIsLoading(true);
    setError('');
    setSaveToWalletUrl(''); // Explicitly clear previous URL at the start

    try {
      const response = await fetch('/api/wallet/create-pass', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('CLIENT: API Response Status:', response.status); // Log status

      const data: ApiWalletResponse = await response.json();
      console.log('CLIENT: API Response Data:', data); // Log the data received

      if (response.ok && data.saveToWalletUrl) {
        console.log('CLIENT: Setting saveToWalletUrl:', data.saveToWalletUrl);
        setSaveToWalletUrl(data.saveToWalletUrl);
      } else {
        console.error('CLIENT: Failed to get saveToWalletUrl from API.', data);
        setError(data.error || data.message || 'Failed to generate pass. No URL received from API.');
        setSaveToWalletUrl(''); // Ensure it's cleared on error
      }
    } catch (err: any) {
      console.error('CLIENT: Error in handleGeneratePass catch block:', err);
      setError(err.message || 'An unexpected error occurred during API call.');
      setSaveToWalletUrl(''); // Ensure it's cleared on error
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Loading session...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen p-4 text-center">
        <Head>
          <title>Access Denied | HackWestern Pass</title>
        </Head>
        <h1 className="text-2xl font-semibold mb-4">Access Denied</h1>
        <p className="mb-6">Please sign in to generate your HackWestern digital pass.</p>
        <button 
          onClick={() => signIn()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
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
        <meta name="description" content="Generate your personalized HackWestern Google Wallet pass." />
      </Head>
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-6">Your HackWestern Digital Pass</h1>
          
          {saveToWalletUrl ? (
            <div className="mt-8 flex flex-col items-center">
              <p className="mb-6 text-lg text-gray-700 dark:text-gray-300">
                Your pass is ready! Click the button below to add it to your Google Wallet.
              </p>
              <WalletButton saveToWalletUrl={saveToWalletUrl} />
              <button
                onClick={() => {
                  setSaveToWalletUrl(null); // Allow generating a new pass
                  setError(null); // Clear previous errors
                }} 
                className="mt-6 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Generate New Pass
              </button>
            </div>
          ) : (
            <>
              <p className="mb-8 text-lg text-gray-700 dark:text-gray-300">
                Get your personalized digital pass for HackWestern! Click the button below to generate your pass.
              </p>
              <button
                onClick={handleGeneratePass}
                disabled={isLoading}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Generating...' : 'Generate My Wallet Pass'}
              </button>
            </>
          )}

          {error && (
            <div className="mt-6 p-4 bg-red-100 text-red-700 border border-red-300 rounded-md">
              <p className="font-semibold">Error:</p>
              <p>{error}</p>
            </div>
          )}

           {!isLoading && !saveToWalletUrl && !error && (
            <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg shadow-sm text-left">
                <p className="text-blue-700 dark:text-blue-300">Click the "Generate My Wallet Pass" button to get started.</p>
            </div>
           )}
        </div>
      </main>
    </>
  );
};

export default WalletPassPage;
