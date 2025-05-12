import { motion } from "framer-motion";
import { Draggable } from "../canvas/draggable";

const TestPageMap = () => {
  return (
    <motion.div className="h-screen w-screen bg-blue-100 px-4 pt-16">
      <div className="mb-4 text-center text-2xl font-semibold text-blue-800">
        Drag any box
      </div>
      <div className="mx-auto grid max-w-2xl grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <Draggable
            key={n}
            drag
            className="h-24 cursor-move rounded bg-blue-500 p-4 text-center text-white shadow-md"
          >
            Box {n}
          </Draggable>
        ))}
      </div>
    </motion.div>
  );
};

export default TestPageMap;