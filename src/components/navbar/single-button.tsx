import { useState, useEffect } from "react";
import * as LucideIcons from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "../hooks/use-toast";

type IconName = keyof typeof LucideIcons;

interface SingleButtonProps {
  label: string;
  icon?: IconName;
  customIcon?: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  isPushed: boolean;
  link?: string;
  emailAddress?: string;
}

export default function SingleButton({
  label,
  icon,
  customIcon,
  onClick,
  isPushed,
  link,
  emailAddress,
}: SingleButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showTag, setShowTag] = useState(false);
  const Icon = icon ? (LucideIcons[icon] as LucideIcons.LucideIcon) : null;
  const CustomIcon = customIcon;
  const TagDelay = 100;
  const { toast } = useToast();

  // Ensure either icon or customIcon is provided
  if (!Icon && !CustomIcon) {
    throw new Error("Either 'icon' or 'customIcon' prop must be provided");
  }

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (isHovered) {
      timeoutId = setTimeout(() => {
        setShowTag(true);
      }, TagDelay);
    } else {
      setShowTag(false);
    }

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isHovered]);

  const handleClick = () => {
    // Handle email copying with toast
    if (emailAddress) {
      const mailtoLink = `mailto:${emailAddress}`;
      
      // Try to copy to clipboard
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(mailtoLink)
          .then(() => {
            toast({
              title: "Email copied! :)",
              duration: 3000,
              variant: "cute",
            });
          })
          .catch((error) => {
            console.error('Failed to copy to clipboard:', error);
            // Fallback: try copying just the email address
                          navigator.clipboard.writeText(emailAddress) 
                .then(() => {
                  toast({
                    title: "Email copied! :)",
                    duration: 3000,
                    variant: "cute",
                  });
                })
              .catch(() => {
                // Final fallback: open email client
                window.open(mailtoLink, '_blank');
                toast({
                  title: "Email app opened! :)",
                  duration: 3000,
                  variant: "cute",
                });
              });
          });
      } else {
        // Fallback for non-secure contexts or older browsers
        try {
          // Try the deprecated execCommand method
          const textArea = document.createElement('textarea');
          textArea.value = emailAddress;
          document.body.appendChild(textArea);
          textArea.select();
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          
          if (successful) {
            toast({
              title: "Email copied! :)",
              duration: 3000,
              variant: "cute",
            });
          } else {
            throw new Error('execCommand failed');
          }
        } catch (error) {
          console.error('All copy methods failed:', error);
          // Final fallback: open email client
          window.open(mailtoLink, '_blank');
          toast({
            title: "Email app opened! :)",
            duration: 3000,
            variant: "cute",
          });
        }
      }
      return;
    }

    // Handle link redirection
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
      return;
    }

    // Default onClick behavior
    onClick?.();
  };

  return (
    <div className="relative">
      <motion.button
        className={`relative flex items-center rounded-sm p-2 transition-colors duration-200 ${
          isPushed
            ? "bg-purple-900 text-white"
            : isHovered
              ? "bg-[#F5F2F6]"
              : ""
        }`}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        whileTap={{ scale: 0.95 }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 25,
        }}
      >
        {isPushed ? (
          <div className="flex items-center gap-3">

            <div>
              {Icon ? (
                <Icon
                  className={`h-5 w-5 flex-shrink-0 ${
                    isPushed ? "text-white" : "text-heavy"
                  }`}
                />
              ) : CustomIcon ? (
                <CustomIcon
                  className={`h-5 w-5 flex-shrink-0 ${
                    isPushed ? "text-white" : "text-heavy"
                  }`}
                />
              ) : null}
            </div>
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{
                duration: 0.1,
                ease: "easeInOut",
              }}
              className="overflow-hidden whitespace-nowrap text-sm font-medium text-white"
            >
              {label}
            </motion.span>
          </div>
        ) : (
          <div>
            {Icon ? (
              <Icon
                className={`h-5 w-5 flex-shrink-0 ${
                  isPushed ? "text-white" : "text-heavy"
                }`}
              />
            ) : CustomIcon ? (
              <CustomIcon
                className={`h-5 w-5 flex-shrink-0 ${
                  isPushed ? "text-white" : "text-heavy"
                }`}
              />
            ) : null}
            <AnimatePresence>
              {showTag && !isPushed && (
                <motion.div
                  initial={{ opacity: 0, y: 5, scale: 0.9, x: "-50%" }}
                  animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
                  exit={{ opacity: 0, y: 5, scale: 0.9, x: "-50%" }}
                  transition={{
                    duration: 0.05,
                    ease: "easeOut",
                  }}
                  className="absolute z-50 pointer-events-none -top-10 left-1/2"
                >
                  <div className="rounded-sm bg-gradient-to-t from-black/10 to-transparent px-[1px] pb-[2.5px] pt-[1px]">
                    <div className="whitespace-nowrap rounded-sm bg-white px-2 py-1 text-sm text-black">
                      {label}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.button>
    </div>
  );
}
