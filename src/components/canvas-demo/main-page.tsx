import { Draggable } from "../canvas/draggable";
import Image from "next/image";

const MainPage = () => {
  return (
    <div className="absolute flex h-screen w-screen flex-col items-center justify-center bg-hw-radial-gradient">
      hello im hack western :)))
      <Draggable
        drag
        className="m-8 w-32 cursor-grab rounded bg-blue-500 p-4 text-center text-white shadow-lg"
      >
        Draggable 1
      </Draggable>
      <Draggable
        drag
        className="m-4 w-32 cursor-grab rounded bg-red-500 p-4 text-center text-white shadow-lg"
      >
        Draggable 2
      </Draggable>
      <div className="flex gap-4">
        <Draggable drag>
          <Image
            src="/images/wildlifewanderer.svg"
            alt="Avatar"
            width={250}
            height={250}
            draggable="false"
          />
        </Draggable>
        <Draggable drag>
          <Image
            src="/images/citycruiser.svg"
            alt="Avatar"
            width={250}
            height={250}
            draggable="false"
          />
        </Draggable>
        <Draggable drag>
          <Image
            src="/images/foodiefanatic.svg"
            alt="Avatar"
            width={250}
            height={250}
            draggable="false"
          />
        </Draggable>
        <Draggable drag>
          <Image
            src="/images/beachbum.svg"
            alt="Avatar"
            width={250}
            height={250}
            draggable="false"
          />
        </Draggable>
      </div>
    </div>
  );
};

export default MainPage;
