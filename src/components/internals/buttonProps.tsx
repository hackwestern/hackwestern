export interface ButtonProps {
  children: React.ReactNode;
  isSkeleton?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
  onClick?: () => void;
  onMouseDown?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  size?: "sm" | "lg";
  direction?: "left" | "right";
  className?: string;
}
