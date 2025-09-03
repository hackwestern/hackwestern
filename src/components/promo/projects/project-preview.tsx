import FolderIcon from "../../ui/FolderIcon";
import { CardStack } from "./card-stack";

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
    <div className="relative h-48 w-48">
      <FolderIcon
        className="absolute inset-0 z-10"
        gradientId={gradientId}
        isOpen={isOpen}
      />

      <div
        className={`z-9 absolute left-2 top-0 transition-all duration-300 ${
          !isOpen ? "opacity-60 blur-sm" : "opacity-100 blur-0"
        }`}
      >
        <CardStack
          isOpen={isOpen}
          names={cards.map(([image, link, name]) => ({ image, link, name }))}
          folder={folder.toLowerCase()}
        />
      </div>
      <span className="absolute bottom-4 left-1/2 block -translate-x-1/2 whitespace-nowrap text-center font-jetbrains-mono text-[15px] font-light">
        {label}
      </span>
    </div>
  );
};
