import { coordinates } from "~/constants/canvas";
import { CanvasComponent } from "../canvas/canvas";

function Team() {
  return (
    <CanvasComponent offset={coordinates.team}>
      <div className="flex h-screen w-screen items-center justify-center">
        <h1 className="text-5xl font-bold">Team</h1>
      </div>
    </CanvasComponent>
  );
}

export default Team;
