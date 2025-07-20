import { coordinates } from "~/constants/canvas";
import { CanvasComponent } from "../../canvas/canvas";
import Book from "./book";
import Title from "./title";

function Team() {
  return (
    <CanvasComponent offset={coordinates.team}>
      <div className="my-auto flex h-screen w-screen flex-col items-center justify-center">
        <Title />
        <Book />
      </div>
    </CanvasComponent>
  );
}

export default Team;
