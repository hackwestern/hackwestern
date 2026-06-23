export interface ButtonProps {
  children: React.ReactNode;
  isSkeleton?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
  onClick?: () => void;
  size?: "sm" | "lg";
  direction?: "left" | "right";
  className?: string;
}
