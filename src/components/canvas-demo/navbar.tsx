import { type Point } from "framer-motion";
import { type OffsetIndex, OFFSETS } from "~/pages/canvas";
import { motion } from "framer-motion";

const NavbarButton = ({
  offset,
  text,
  onClick,
}: {
  offset: OffsetIndex;
  text: string;
  onClick: (offset: Point) => void;
}) => {
  return (
    <motion.button
      className="mx-2 h-max text-wrap rounded bg-gray-700 p-2 font-mono"
      onClick={() => onClick(OFFSETS[offset])}
      onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
      whileHover={{ scale: 1.05, rotate: 1 }}
      whileTap={{ scale: 0.95, rotate: -1 }}
      initial={{ opacity: 0, y: -20 }}
      animate={{
        opacity: 1,
        y: 0,
        transition: { type: "spring", stiffness: 300 },
      }}
      exit={{ opacity: 0, y: 20 }}
    >
      {text}
    </motion.button>
  );
};

const Navbar = ({ onClick }: { onClick: (offset: Point) => void }) => {
  return (
    <div className="fixed top-0 z-30 flex h-16 w-full justify-center p-4 px-4 text-white">
      {[
        ["0", "Main Page"],
        ["1", "Test Page 1"],
        ["3", "Test Page 2"],
        ["2", "Test Page Map"],
        ["4", "Test Page Boxes"],
        ["5", "Promo"],
      ].map(([offset, text]) => (
        <NavbarButton
          key={offset}
          offset={offset as OffsetIndex}
          text={text!}
          onClick={onClick}
        />
      ))}
    </div>
  );
};

export default Navbar;
