// components/ui/project-preview.tsx
import FolderIcon from "../ui/FolderIcon";
import { CardStack } from "../ui/card-stack";

type ProjectPreviewProps = {
  label: string;
  gradientId: string;
  isOpen: boolean;
  cards: string[][];
  folder: string;
};

export const ProjectPreview = ({
  label,
  gradientId,
  isOpen,
  cards,
  folder,
}: ProjectPreviewProps) => {
  return (
    <div className="relative h-32 w-32">
      {/*  Folder */}
      <FolderIcon
        className="absolute inset-0 z-10 w-32"
        gradientId={gradientId}
        isOpen={isOpen}
      />

      {/* Card stack overlaid */}
      <div
        className={`z-9 absolute left-2 top-0 transition-all duration-300 ${
          !isOpen ? "opacity-60 blur-sm" : "opacity-100 blur-0"
        }`}
      >
        <CardStack
          isOpen={isOpen}
          names={cards.map(([image, link]) => ({ image, link }))}
          folder={folder.toLowerCase()}
        />
      </div>

      {/* Label below */}
      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center font-jetbrains-mono text-[12px] font-medium">
        {label}
      </span>
    </div>
  );
};
