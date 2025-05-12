import { motion } from "framer-motion";
import { useState } from "react";
import { Draggable } from "../canvas/draggable";

const TestPageBoxes = () => {
  const [boxes, setBoxes] = useState<number[]>([]);

  return (
    <motion.div className="h-screen w-screen bg-yellow-50 px-4 pt-16">
      <div className="mb-6 text-center text-xl font-medium text-yellow-800">
        add and delete boxes
      </div>

      <div className="mb-4 flex justify-center gap-4">
        <button
          onClick={() => setBoxes((prev) => [...prev, Date.now()])}
          className="rounded bg-green-500 px-4 py-2 text-white shadow"
        >
          Add Box
        </button>
        <button
          onClick={() => setBoxes((prev) => prev.slice(0, prev.length - 1))}
          className="rounded bg-red-500 px-4 py-2 text-white shadow"
        >
          Delete Box
        </button>
      </div>

      <div className="flex flex-wrap justify-center gap-4">
        {boxes.map((id, index) => (
          <Draggable
            drag
            key={id}
            className={`flex h-24 w-24 items-center justify-center rounded bg-yellow-400 text-center text-white shadow-lg`}
          >
            Box {index}
          </Draggable>
        ))}
      </div>
    </motion.div>
  );
};

export default TestPageBoxes;
