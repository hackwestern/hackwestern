import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="bottom-center"
      className="toaster group"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full items-center justify-center gap-2 rounded-dashboard-2xl border border-dashboard-border-faint bg-dashboard-bg-highlight px-6 py-4 font-figtree text-base font-normal leading-default text-dashboard-text-heavy",
          description: "text-sm text-dashboard-text-light",
          actionButton:
            "rounded-dashboard-lg bg-dashboard-action-primary px-3 py-1 text-sm font-medium text-dashboard-text-inverse",
          cancelButton:
            "rounded-dashboard-lg bg-dashboard-bg-nav px-3 py-1 text-sm font-medium text-dashboard-text-heavy",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
