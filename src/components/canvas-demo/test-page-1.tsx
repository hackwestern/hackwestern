import { motion } from "framer-motion";
import { Draggable } from "../canvas/draggable";

const TestPage1 = () => {
  return (
    <motion.div className="absolute left-[2200px] top-[2000px] h-screen w-screen bg-gray-200">
      <div className="text-center text-3xl font-bold text-gray-800">
        This is a large background element
      </div>
      <Draggable
        drag
        className="mx-auto w-32 cursor-grab rounded bg-green-500 p-4 text-center text-white shadow-lg"
        onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
      >
        Draggable 3
      </Draggable>
    </motion.div>
  );
};

export default TestPage1;