import { cn } from "~/lib/utils";
import { Spinner } from "~/components/loading-spinner";

type LoadingOverlayProps = {
  isLoading: boolean;
  children: React.ReactNode;
  className?: string;
  overlayClassName?: string;
  spinnerClassName?: string;
  loadingText?: string;
};

export function LoadingOverlay({
  isLoading,
  children,
  className,
  overlayClassName,
  spinnerClassName,
  loadingText = "Loading...",
}: LoadingOverlayProps) {
  return (
    <div className={cn("relative", className)}>
      {children}
      {isLoading && (
        <div
          className={cn(
            "absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm",
            overlayClassName,
          )}
        >
          <div className="flex flex-col items-center space-y-4">
            <Spinner
              isLoading={true}
              className={cn("h-8 w-8 text-blue-600", spinnerClassName)}
            />
            <p className="text-lg font-medium text-gray-700">{loadingText}</p>
          </div>
        </div>
      )}
    </div>
  );
}
