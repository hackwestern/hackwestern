import { coordinates } from "~/constants/canvas";
import Book from "./book";
import Title from "./title";
import { CanvasComponent } from "~/components/canvas/component";

function Team() {
  return (
    <CanvasComponent
      offset={coordinates.team}
      imageFallback="/images/promo/team.png"
    >
      <div className="flex scale-90 flex-col items-center justify-center">
        <Title />
        <Book />
      </div>
    </CanvasComponent>
  );
}

export default Team;
