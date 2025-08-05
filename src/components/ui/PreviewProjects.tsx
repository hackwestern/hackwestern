// components/ui/project-preview.tsx
import FolderIcon from "../ui/FolderIcon";
import { CardStack } from "../ui/card-stack";

type ProjectPreviewProps = {
	label: string;
	gradientId: string;
	isOpen: boolean;
	cardNames: string[];
	folder: string;
};

export const ProjectPreview = ({ label, gradientId, isOpen, cardNames, folder }: ProjectPreviewProps) => {
	return (
		<div className="relative w-32 h-40">
			{/* Folder */}
			<FolderIcon
				className="absolute inset-0 z-10 w-32"
				gradientId={gradientId}
				isOpen={isOpen}
			/>

			{/* Card stack overlaid */}
			<div
				className={`absolute top-4 left-2 z-9 transition-all duration-300 ${!isOpen ? "blur-sm opacity-60" : "blur-0 opacity-100"
					}`}
			>
				<CardStack isOpen={isOpen} names={cardNames} folder={folder.toLowerCase()} />
			</div>

			{/* Label below */}
			<span className="absolute bottom-[-1.5rem] left-1/2 -translate-x-1/2 font-jetbrains-mono font-medium text-[12px] text-center">
				{label}
			</span>
		</div>
	);
};
