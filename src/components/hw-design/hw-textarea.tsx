import { ReactNode, TextareaHTMLAttributes } from "react";

function HWTextArea({
  title,
  placeholder,
  subtitle,
  className = "",
  variant,
  children,
  ...props
}: {
  title: string;
  placeholder: string;
  subtitle: string;
  className?: string;
  children?: ReactNode;
  variant: "primary" | "destructive" | "outline" | "subtle";
} & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="flex w-full flex-col gap-2">
      <p className="pl-1 font-medium">{title}</p>
      <textarea
        className="rounded-xl bg-primary-50 px-5 py-2 text-black outline outline-2 outline-primary-300 hover:bg-primary-200"
        placeholder={placeholder}
      />
      <p className="pl-1 font-light text-gray-700">{subtitle}</p>
    </div>
  );
}

export default HWTextArea;
