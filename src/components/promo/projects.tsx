import { CanvasComponent } from "../canvas/canvas";
import { coordinates } from "~/constants/canvas";
import { motion } from "framer-motion";
import { useState } from "react";
import { ProjectPreview } from "../ui/PreviewProjects";
import HeaderCards from "../ui/HeaderCards";

function Projects() {
  const folderData = [
    {
      label: "CREATIVE ARTS",
      gradientId: "red",
      align: "self-end",
      cards: [
        ["Git-place.png", "https://devpost.com/software/git-place"],
        ["Ghostwriter.png", "https://devpost.com/software/ghostwriter-qf69jk"],
        ["Dream Scape.png", "https://devpost.com/software/dreamscape-vbkud5"],
      ],
    },
    {
      label: "AI-POWERED",
      gradientId: "blue",
      align: "self-start",
      cards: [
        ["Co:Herent.png", "https://devpost.com/software/co-herent"],
        ["Talk to Duckie.png", "https://dorahacks.io/buidl/20337"],
        ["Bravo Dispatch.png", "https://dorahacks.io/buidl/20371"],
      ],
    },
    {
      label: "GAMES",
      gradientId: "green",
      align: "self-end",
      cards: [
        ["Ar-cade.png", "https://devpost.com/software/ar-cade"],
        ["PacRoyale.png", "https://dorahacks.io/buidl/20381"],
        [
          "Credit Crimes.png",
          "https://devpost.com/software/papers-please-clone",
        ],
      ],
    },
    {
      label: "DELIGHTFUL DESIGN",
      gradientId: "purple",
      align: "self-start",
      cards: [
        ["Genee.png", "https://devpost.com/software/tempname-ilm584"],
        ["Harbor-Ed.png", "https://devpost.com/software/harbor-ed"],
        ["Blocks.png", "https://dorahacks.io/buidl/20342"],
      ],
    },
    {
      label: "HARDWARE HACKS",
      gradientId: "orange",
      align: "self-end",
      cards: [
        ["infu.png", "https://devpost.com/software/infu"],
        ["SuperStage.png", "https://devpost.com/software/superstage"],
        ["HoverTouch.png", "https://devpost.com/software/hovertouch"],
      ],
    },
  ];
  const placeHolder: [[string, string][], string[]] = [
    [
      ["Git-place.png", "You've heard of r/place now there's git-place."],
      [
        "Co:Herent.png",
        "Leveraging text generation to streamline communication with the hearing impaired.",
      ],
      ["Ar-cade.png", "Classic games played with new technology!"],
    ],
    ["creative arts", "ai-powered", "games"],
  ];
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  return (
    <CanvasComponent offset={coordinates.projects}>
      <div className="flex w-[60rem] flex-col items-center">
        {/* Top projects */}
        <HeaderCards
          names={placeHolder[0].map(([image, description]) => ({
            image,
            description,
          }))}
          folder={placeHolder[1]}
        />
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
        <div className="flex h-44 w-[60rem] shrink-0 justify-between">
          {folderData.map((folder, index) => (
            <div
              key={folder.label}
              className={`${folder.align} relative flex flex-col items-center`}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <ProjectPreview
                label={folder.label}
                gradientId={folder.gradientId}
                isOpen={hoveredIndex === index}
                cards={folder.cards}
                folder={folder.label}
              />
            </div>
          ))}
        </div>{" "}
      </div>
    </CanvasComponent>
  );
}

export default Projects;
