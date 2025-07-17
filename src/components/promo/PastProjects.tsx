import { CanvasComponent } from "../canvas/canvas";
import { motion } from "framer-motion";
import { useState } from "react";

function PastProjects() {
  const [hovered, setHovered] = useState(false);

  return (
    <CanvasComponent offset={{ x: "70%", y: "40%" }}>
        <div className="w-[640px] inline-flex flex-col justify-center items-center gap-6">
                <div className="self-stretch text-center justify-start text-zinc-500 text-base font-medium font-jetbrains-mono uppercase">past projects</div>
                <div className="self-stretch text-center justify-start text-indigo-950 text-3xl font-medium font-dico">The world is waiting for your creation.</div>
                <div className="self-stretch text-center justify-start text-zinc-500 text-base font-medium font-figtree">Here are what other students like you have created at Hack Western.</div>
                <motion.img
                    src="/PastProjectsBubble.svg"
                    alt="Past Projects Bubbld"
                    width={440}
                    height={418}
                    draggable="false"
                />
            <div className="w-[640px] text-center justify-start text-zinc-500 text-base font-medium font-['Figtree']">Here are what other students like you have created at Hack Western.</div>
        </div>
    </CanvasComponent>
  );
}

export default PastProjects;


