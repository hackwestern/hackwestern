import { coordinates } from "~/constants/canvas";
import { CanvasComponent } from "../canvas/canvas";

function Projects() {
  return (
    <CanvasComponent offset={coordinates.projects}>
      <div className="flex items-center justify-center">
        <h1 className="text-5xl font-bold">Projects</h1>
      </div>
    </CanvasComponent>
  );
}

export default Projects;
