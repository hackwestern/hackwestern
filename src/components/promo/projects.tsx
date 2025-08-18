import { CanvasComponent } from "../canvas/canvas";
import { coordinates } from "~/constants/canvas";
import { useState } from "react";
import { folderData } from "~/constants/folderData";
import { ProjectPreview } from "../ui/PreviewProjects";
import { projectsPlaceHolder } from "~/constants/projectsPlaceholder";
import HeaderCards from "../ui/HeaderCards";

function Projects() {
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
	return (
		<CanvasComponent offset={coordinates.projects}>
			<div className="flex w-full h-[815px] flex-col items-center shrink-0">
				{/* Top projects */}
				<HeaderCards
					names={projectsPlaceHolder[0].map(([image, description]) => ({
						image,
						description,
					}))}
					folder={projectsPlaceHolder[1]}
				/>
				<div className="flex h-[111px] w-full items-center justify-center mb-[100px] shrink-0">
					<div className="inline-flex w-full flex-col items-center justify-center shrink-0">
						<div className="justify-start self-stretch text-center font-jetbrains-mono text-base font-medium uppercase text-zinc-500 mb-[24px]">
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
				<div className="flex h-[180px] w-[60rem] shrink-0 justify-between">
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
				</div>
			</div>
		</CanvasComponent>
	);
}

export default Projects;
