import { Draggable } from "../canvas/draggable";
import { motion } from "framer-motion";

const avatars = [
  "/images/wildlifewanderer.svg",
  "/images/citycruiser.svg",
  "/images/foodiefanatic.svg",
  "/images/beachbum.svg",
];

const Avatars = () => {
  return (
    <div className="flex gap-4">
      {avatars.map((avatar, index) => (
        <Draggable
          key={index}
          animate={{
            rotate: [3, -3],
            transition: {
              duration: 1,
              repeat: Infinity,
              repeatType: "mirror",
              ease: "easeInOut",
            },
          }}
        >
          <motion.img
            src={avatar}
            alt={`Avatar ${index + 1}`}
            width={250}
            height={250}
            draggable="false"
          />
        </Draggable>
      ))}
    </div>
  );
};

const MainPage = () => {
  return (
    <div className="absolute flex h-screen w-screen flex-col items-center justify-center bg-hw-radial-gradient">
      hello im hack western :)))
      <Draggable className="m-8 w-32 cursor-grab rounded bg-blue-500 p-4 text-center text-white shadow-lg">
        Draggable 1
      </Draggable>
      <Draggable className="m-4 w-32 cursor-grab rounded bg-red-500 p-4 text-center text-white shadow-lg">
        Draggable 2
      </Draggable>
      <Avatars />
    </div>
  );
};

export default MainPage;
