import Head from "next/head";
import { useRouter } from "next/router";
import { Button } from "~/components/ui/button";
import Link from "next/link";
import CloudBackground from "~/components/cloud-background";

export default function OAuthError() {
  const router = useRouter();
  const { error, message } = router.query;

  const getErrorMessage = () => {
    switch (error) {
      case "AccessDenied":
        return {
          title: "Account Already Exists",
          description: "This email is already registered with a different sign-in method. Please use your existing account or try a different email address.",
          action: "Try signing in with your existing account"
        };
      case "Configuration":
        return {
          title: "Sign-in Error",
          description: "There was a problem with your sign-in. Please try again or contact support if the issue persists.",
          action: "Try again"
        };
      default:
        return {
          title: "Sign-in Error",
          description: "Something went wrong during sign-in. Please try again.",
          action: "Try again"
        };
    }
  };

  const errorInfo = getErrorMessage();

  return (
    <>
      <Head>
        <title>Sign-in Error - Hack Western</title>
        <meta
          name="description"
          content="Hack Western: One of Canada's largest annual student-run hackathons based out of Western University in London, Ontario."
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="flex h-screen flex-col items-center justify-center bg-hw-radial-gradient">
        <CloudBackground />
        <div className="z-10 w-full max-w-2xl rounded-lg bg-white p-12 shadow-md">
          <div className="text-center">
            <div className="mb-6 text-6xl">⚠️</div>
            <h1 className="mb-4 text-3xl font-bold text-red-600">
              {errorInfo.title}
            </h1>
            <p className="mb-8 text-lg text-gray-700">
              {errorInfo.description}
            </p>
            
            {message && (
              <div className="mb-6 rounded-lg bg-gray-100 p-4">
                <p className="text-sm text-gray-600">
                  <strong>Details:</strong> {message}
                </p>
              </div>
            )}

            <div className="space-y-4">
              <Button 
                variant="primary" 
                className="w-full"
                onClick={() => router.push("/login")}
              >
                {errorInfo.action}
              </Button>
              
              <div className="text-sm text-gray-500">
                Need help?{" "}
                <Link 
                  href="/contact" 
                  className="text-blue-500 hover:text-blue-700"
                >
                  Contact Support
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
