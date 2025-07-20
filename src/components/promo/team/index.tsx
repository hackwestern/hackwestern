import { coordinates } from "~/constants/canvas";
import { CanvasComponent } from "../../canvas/canvas";
import Book from "./book";

function Team() {
  return (
    <CanvasComponent offset={coordinates.team}>
      <div className="my-auto flex h-screen w-screen flex-col items-center justify-center">
        <div className="flex flex-col gap-4 text-center">
          <h1 className="my-2 font-jetbrains-mono text-lg font-medium text-medium">
            OUR TEAM
          </h1>
          <div className="font-dico text-3xl text-heavy">
            Meet the team behind the event!
          </div>
          <div className="font-figtree text-medium">
            We&apos;re here to help bring your ideas to life.
          </div>
        </div>
        <Book />
      </div>
    </CanvasComponent>
  );
}

export default Team;
