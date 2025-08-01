import { CanvasComponent } from "../canvas/canvas";
import { coordinates } from "~/constants/canvas";
import { motion } from "framer-motion";
import FolderIcon from "../ui/FolderIcon";

function Projects() {
  return (
    <CanvasComponent offset={coordinates.projects}>
      <div className="flex w-[60rem] flex-col items-center">
        {/* Top projects */}
        <div className="flex">
          <div className="flex h-[300px] w-[380px] shrink-0 flex-col items-start gap-[14px] rounded-[16px] border-[rgba(119,103,128,0.10)] bg-[#FBFBFB] p-[12px] shadow-[0_8px_12px_0_rgba(119,115,149,0.25)]" />
        </div>

        <div className="flex h-screen w-screen items-center justify-center">
          <div className="inline-flex w-[640px] flex-col items-center justify-center gap-6">
            <div className="justify-start self-stretch text-center font-jetbrains-mono text-base font-medium uppercase text-zinc-500">
              past projects
            </div>
            <div className="justify-start self-stretch text-center font-dico text-3xl font-medium text-indigo-950">
              The world is waiting for your creation.
            </div>
            <div className="justify-start self-stretch text-center font-figtree text-base font-medium text-zinc-500">
              Here are what other students like you have created at Hack
              Western.
            </div>
          </div>
        </div>

        {/* Folders */}
        <div className="w-200 flex h-44 w-[60rem] shrink-0 justify-between">
          <div className="flex flex-col self-end">
            <FolderIcon className="w-32" gradientId="red" />
            <span className="mt-4 block text-center font-jetbrains-mono text-[12px] font-medium text-medium">
              CREATIVE ARTS
            </span>
          </div>
          <div className="self-start">
            <FolderIcon className="w-32" gradientId="blue" />
            <span className="mt-4 block text-center font-jetbrains-mono text-[12px] font-medium text-medium">
              AI-POWERED
            </span>
          </div>
          <div className="self-end">
            <FolderIcon className="w-32" gradientId="green" />
            <span className="mt-4 block text-center font-jetbrains-mono text-[12px] font-medium text-medium">
              GAMES
            </span>
          </div>
          <div className="self-start">
            <FolderIcon className="w-32" gradientId="purple" />
            <span className="mt-4 block text-center font-jetbrains-mono text-[12px] font-medium text-medium">
              DELIGHTFUL DESIGN
            </span>
          </div>
          <div className="self-end">
            <FolderIcon className="w-32" gradientId="orange" />
            <span className="mt-4 block text-center font-jetbrains-mono text-[12px] font-medium text-medium">
              HARDWARE
            </span>
          </div>
        </div>
      </div>
    </CanvasComponent>
  );
}

export default Projects;
