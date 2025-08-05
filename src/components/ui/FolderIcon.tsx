import { motion } from "framer-motion";

type FolderIconProps = {
	className?: string;
	gradientId?: string;
	strokeColor?: string;
	isOpen?: boolean;
};

const AnimatedFolderIcon = ({
	className = "",
	gradientId = "defaultGradient",
	strokeColor = "rgba(119, 103, 128, 0.1)",
	isOpen = false,
}: FolderIconProps) => {
	return (
		<svg
			viewBox="0 0 208 163"
			className={className}
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<g filter="url(#folderShadow)">
				{/* Closed Folder */}
				<motion.g
					initial={false}
					animate={{
						opacity: isOpen ? 0 : 1,
						scale: isOpen ? 1 : 1,
						y: isOpen ? 5 : 0,
						x: isOpen ? 15 : 15,
					}}
					transition={{
						duration: 0.2,
						ease: "easeInOut",
					}}
				>
					<path
						d="M4.34444 14.3331C4.1561 8.68286 8.68546 4 14.3389 4L76.1646 4C80.3832 4 84.4311 5.66604 87.4274 8.63558L98.3226 19.4333C101.319 22.4028 105.367 24.0689 109.585 24.0689H173.601C179.277 24.0689 183.815 28.7881 183.593 34.4601L179.876 129.391C179.666 134.758 175.255 139 169.884 139H18.1722C12.7791 139 8.35744 134.723 8.17777 129.333L4.34444 14.3331Z"
						fill={`url(#${gradientId})`}
						stroke={strokeColor}
						strokeWidth="0.75"
						fillOpacity="0.8"
					/>
				</motion.g>

				{/* Open Folder */}
				<motion.g
					initial={false}
					animate={{
						opacity: isOpen ? 1 : 0,
						scale: isOpen ? 1.15 : 1.15,
						y: isOpen ? 20 : 20,
						x: isOpen ? 23 : 23,
					}}
					transition={{
						duration: 0.2,
						ease: "easeInOut",
					}}
				>
					<path
						d="M3.72714 12.7562C3.28295 7.78306 7.20051 3.5 12.1934 3.5L67.2044 3.5C70.2086 3.5 73.1283 4.49474 75.5076 6.32893L89.3807 17.0235C91.76 18.8577 94.6797 19.8524 97.6839 19.8524H154.462C159.507 19.8524 163.442 24.2216 162.916 29.2393L154.874 105.887C154.42 110.214 150.772 113.5 146.421 113.5H20.5C16.0986 113.5 12.4253 110.14 12.0337 105.756L3.72714 12.7562Z"
						fill={`url(#${gradientId})`}
						stroke={strokeColor}
						strokeOpacity="1"
						strokeWidth="0.85"
						fillOpacity="1"
					/>
				</motion.g>
			</g>
			<defs>
				<linearGradient id="red" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor="rgba(226, 141, 159, 1)" />
					<stop offset="100%" stopColor="rgba(244, 193, 204, 1)" />
				</linearGradient>
				<linearGradient id="blue" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor="rgba(90, 149, 208, 1)" />
					<stop offset="100%" stopColor="rgba(158, 202, 246, 1)" />
				</linearGradient>
				<linearGradient id="green" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor="rgba(127, 202, 132, 1)" />
					<stop offset="100%" stopColor="rgba(185, 227, 188, 1)" />
				</linearGradient>
				<linearGradient id="purple" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor="rgba(143, 87, 173, 1)" />
					<stop offset="100%" stopColor="rgba(209, 154, 238, 1)" />
				</linearGradient>
				<linearGradient id="orange" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor="rgba(233, 148, 111, 1)" />
					<stop offset="100%" stopColor="rgba(246, 185, 158, 1)" />
				</linearGradient>

				<filter id="folderShadow" x="-10" y="-10" width="208" height="163" filterUnits="userSpaceOnUse">
					<feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="rgba(119, 115, 149, 0.35)" />
				</filter>
			</defs>
		</svg>
	);
};

export default AnimatedFolderIcon;
