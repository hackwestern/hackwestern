import { type Point } from "framer-motion";
import { type OffsetIndex, OFFSETS } from "~/pages/canvas-demo";

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
    <button
      className="mx-2 rounded bg-gray-700 p-2 font-mono text-sm"
      onClick={() => onClick(OFFSETS[offset])}
    >
      {text}
    </button>
  );
};

const Navbar = ({ onClick }: { onClick: (offset: Point) => void }) => {
  return (
    <div className="fixed top-0 z-30 mx-auto flex h-16 w-full justify-center p-4 text-white">
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
