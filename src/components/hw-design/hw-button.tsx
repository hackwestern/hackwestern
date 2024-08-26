import { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * A reusable Hack Western button component with variants and customizable styles and attributes.
 * To override any of the default tailwind styles, pass in custom styles with the className prop, use ! before a className to force style override
 * @param props - The props for the Button component.
 * @param props.className - Additional CSS classes to apply to the button.
 */
function HWButton({
  text,
  className = "",
  variant,
  children,
  ...props
}: {
  text: string;
  className?: string;
  children?: ReactNode;
  variant: "primary" | "destructive" | "outline" | "subtle";
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const stylesVariants = {
    primary: "bg-primary-500 hover:bg-primary-600 text-white",
    destructive: "bg-destructive hover:bg-destructive-dark text-white",
    outline:
      "bg-primary-50 text-black outline outline-2 outline-primary-300 hover:bg-primary-200",
    subtle: "bg-primary-100 hover:bg-primary-200 text-black",
  };
  return (
    <button
      className={`rounded-xl px-5 py-2 font-medium ${stylesVariants[variant]} ${className}`}
      {...props}
    >
      {text}
    </button>
  );
}

export default HWButton;
