import { motion } from "framer-motion";
import { Draggable } from "../canvas/draggable";

const TestPage2 = () => {
  return (
    <motion.div className="h-screen w-screen bg-yellow-50 px-4 pt-16">
      <div className="mb-6 text-center text-xl font-medium text-yellow-800">
        Stack of draggable cards
      </div>
      <div className="flex flex-col items-center gap-4">
        {[1, 2, 3, 4, 5].map((n) => (
          <Draggable
            key={n}
            drag
            className="w-64 rounded bg-yellow-400 p-6 text-center text-white shadow-lg"
          >
            Card {n}
          </Draggable>
        ))}
      </div>
    </motion.div>
  );
};

export default TestPage2;
