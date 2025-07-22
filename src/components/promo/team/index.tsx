import { coordinates } from "~/constants/canvas";
import { CanvasComponent } from "../../canvas/canvas";
import Book from "./book";
import Title from "./title";

function Team() {
  return (
    <CanvasComponent offset={coordinates.team}>
      <div className="flex h-screen w-screen scale-90 flex-col items-center justify-center">
        <Title />
        <Book />
      </div>
    </CanvasComponent>
  );
}

export default Team;
