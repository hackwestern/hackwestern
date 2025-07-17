import { coordinates } from "~/constants/canvas-coordinates";
import { CanvasComponent } from "../canvas/canvas";

function About() {
  return (
    <CanvasComponent offset={coordinates.about}>
      <div className="flex h-screen w-screen items-center justify-center">
        <h1 className="text-5xl font-bold">About</h1>
      </div>
    </CanvasComponent>
  );
}

export default About;
