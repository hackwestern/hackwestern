type FolderIconProps = {
	className?: string;
	gradientId?: string;
	strokeColor?: string;
};

const FolderIcon = ({
	className = "",
	gradientId = "defaultGradient",
	strokeColor = "rgba(119, 103, 128, 0.1)",
}: FolderIconProps) => (
	<svg
		viewBox="0 0 188 143"
		className={className}
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		<g filter="url(#folderShadow)">
			<path
				d="M4.34444 14.3331C4.1561 8.68286 8.68546 4 14.3389 4L76.1646 4C80.3832 4 84.4311 5.66604 87.4274 8.63558L98.3226 19.4333C101.319 22.4028 105.367 24.0689 109.585 24.0689H173.601C179.277 24.0689 183.815 28.7881 183.593 34.4601L179.876 129.391C179.666 134.758 175.255 139 169.884 139H18.1722C12.7791 139 8.35744 134.723 8.17777 129.333L4.34444 14.3331Z"
				fill={`url(#${gradientId})`}
				stroke={strokeColor}
				strokeWidth="0.75"
				fillOpacity="0.8"
			/>
		</g>

		<defs>
			<linearGradient id="red" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stopColor="rgba(226, 141, 159, 0.8)" />
				<stop offset="100%" stopColor="rgba(244, 193, 204, 0.8)" />
			</linearGradient>

			<linearGradient id="blue" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stopColor="rgba(90, 149, 208, 0.8)" />
				<stop offset="100%" stopColor="rgba(158, 202, 246, 0.8)" />
			</linearGradient>

			<linearGradient id="green" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stopColor="rgba(127, 202, 132, 0.8)" />
				<stop offset="100%" stopColor="rgba(185, 227, 188, 0.8)" />
			</linearGradient>

			<linearGradient id="purple" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stopColor="rgba(143, 87, 173, 0.8)" />
				<stop offset="100%" stopColor="rgba(209, 154, 238, 0.8)" />
			</linearGradient>

			<linearGradient id="orange" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stopColor="rgba(233, 148, 111, 0.8)" />
				<stop offset="100%" stopColor="rgba(246, 185, 158, 0.8)" />
			</linearGradient>


			<filter id="folderShadow" x="-10" y="-10" width="208" height="163" filterUnits="userSpaceOnUse">
				<feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="rgba(119, 115, 149, 0.35)" />
			</filter>
		</defs>
	</svg>
);

export default FolderIcon;
