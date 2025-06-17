import Image from "next/image";

const Reset = ({
  onResetViewAndItems,
}: {
  onResetViewAndItems: () => void;
}) => {
  return (
    <div className="text- absolute bottom-4 left-4 z-[1000] flex cursor-[url('/customcursor.svg'),auto]">
      <button
        className="rounded bg-gray-700 p-1.5 font-mono text-xs text-white shadow-md transition-colors hover:bg-gray-600 md:text-sm"
        onClick={onResetViewAndItems}
        onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
      >
        <Image src="/images/reset.svg" alt="Reset" width={18} height={18} />
      </button>
    </div>
  );
};

export default Reset;
