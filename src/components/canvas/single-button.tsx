import { useState, useEffect } from "react";
import * as LucideIcons from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "../hooks/use-toast";
import { toast as SonnerToast } from "sonner";

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
	isPushed: isMaybePushed,
	link,
	emailAddress,
}: SingleButtonProps) {
	const [isHovered, setIsHovered] = useState(false);
	const [showTag, setShowTag] = useState(false);
	const [isMounted, setIsMounted] = useState(false);
	const [copiedEmail, setCopiedEmail] = useState(false);
	const Icon = icon ? (LucideIcons[icon] as LucideIcons.LucideIcon) : null;
	const CustomIcon = customIcon;
	const TagDelay = 100;
	const { toast } = useToast();

	// Ensure either icon or customIcon is provided
	if (!Icon && !CustomIcon) {
		throw new Error("Either 'icon' or 'customIcon' prop must be provided");
	}

	useEffect(() => {
		setIsMounted(true);
	}, []);

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

	// Reset copied email state after 2 seconds
	useEffect(() => {
		if (copiedEmail) {
			const timeoutId = setTimeout(() => {
				setCopiedEmail(false);
			}, 2000);
			return () => clearTimeout(timeoutId);
		}
	}, [copiedEmail]);

	const handleClick = () => {
		// minimal cross-browser copy helper
		const copyText = async (text: string): Promise<boolean> => {
			try {
				if (navigator.clipboard?.writeText && window.isSecureContext) {
					await navigator.clipboard.writeText(text);
					return true;
				}
				// fallback: execCommand
				const ta = document.createElement("textarea");
				ta.value = text;
				document.body.appendChild(ta);
				ta.select();
				const ok = document.execCommand("copy");
				document.body.removeChild(ta);
				return ok;
			} catch {
				return false;
			}
		};

		if (emailAddress) {
			const mailto = `mailto:${emailAddress}`;

			void (async () => {
				const copied =
					(await copyText(mailto)) || (await copyText(emailAddress));

				if (copied) {
					setCopiedEmail(true);
					toast({
						title: "Email copied!",
						variant: "cute",
						duration: 2000,
					});
				} else {
					window.open(mailto, "_blank");
					toast({
						title: "Email app opened!",
						duration: 3000,
						variant: "cute",
					});
				}
			})();

			return;
		}

		if (link) {
			window.open(link, "_blank", "noopener,noreferrer");
			return;
		}

		onClick?.();
	};

	const isPushed = isMounted && isMaybePushed;
	const displayLabel = copiedEmail ? "Email copied!" : label;

	return (
		<motion.button
			aria-label={label}
			className={`relative flex items-center rounded-md p-2 text-medium transition-colors duration-200 ${isPushed ? "bg-[#EEE2FB]" : isHovered ? "bg-highlight" : ""
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
				<div className="flex items-center gap-2">
					<div>
						{Icon ? (
							<Icon
								className={`h-5 w-5 flex-shrink-0 ${isPushed ? "text-emphasis" : "text-medium"}`}
							/>
						) : CustomIcon ? (
							<CustomIcon
								className={`h-5 w-5 flex-shrink-0 ${isPushed ? "text-white" : "text-medium"
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
						className="overflow-hidden whitespace-nowrap font-figtree text-sm font-medium text-emphasis"
					>
						{displayLabel}
					</motion.span>
				</div>
			) : (
				<div>
					{Icon ? (
						<Icon
							className={`h-5 w-5 flex-shrink-0 ${isPushed ? "text-white" : "text-medium"
								}`}
						/>
					) : CustomIcon ? (
						<CustomIcon
							className={`h-5 w-5 flex-shrink-0 ${isPushed ? "text-white" : "text-medium"
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
								className="pointer-events-none absolute -top-10 left-1/2 z-50"
							>
								<div className="rounded-sm bg-gradient-to-t from-black/10 to-transparent px-[1px] pb-[2.5px] pt-[1px]">
									<div className="whitespace-nowrap rounded-sm bg-offwhite px-2 py-1 font-figtree text-sm text-medium">
										{displayLabel}
									</div>
								</div>
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			)}
		</motion.button>
	);
}
