import { coordinates } from "~/constants/canvas-coordinates";
import { CanvasComponent } from "../canvas/canvas";

function FAQ() {
  return (
    <CanvasComponent offset={coordinates.faq}>
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="flex flex-col items-center">
          <h1 className="text-5xl font-bold">FAQ</h1>
        </div>
      </div>
    </CanvasComponent>
  );
}

export default FAQ;
