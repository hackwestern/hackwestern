import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";

export default function Envelope() {
  const [isOpen, setIsOpen] = useState(false);
  const [flapZ, setFlapZ] = useState(20);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
    setFlapZ(0); // instantly send flap behind
  };

  const handleMouseLeave = () => {
    setIsOpen(false);
    timeoutRef.current = setTimeout(() => {
      setFlapZ(20); // delay raising flap back on top
    }, 650);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div
      className="pointer-events-none relative -mt-[150px] h-[375px] w-[450px] rotate-[8deg]"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Letter */}
      <motion.div
        className="pointer-events-auto absolute bottom-0 left-[15px] z-10 w-[420px] overflow-hidden bg-white p-8"
        initial={{ height: "90px" }}
        animate={{ height: isOpen ? "650px" : "90px" }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <div className="mb-2 font-figtree italic text-medium">
          Dear Hacker,
          <br />
        </div>
        <div className="mb-2 font-figtree italic text-medium">
          You belong. <br />
        </div>
        <div className="mb-2 font-figtree italic text-medium">
          Whether you&apos;re an experienced hacker or have never touched a line
          of code, you belong at Hack Western.
          <br />
        </div>
        <div className="mb-2 font-figtree italic text-medium">
          Since the start of Hack Western in 2014, our mission has been to build
          a welcoming and accessible environment for students from all
          backgrounds to learn, build, and pursue their dreams.
          <br />
        </div>
        <div className="mb-2 font-figtree italic text-medium">
          If you&apos;ve been wondering if you belong at a hackathon, YOU DO!
          <br />
        </div>
        <div className="mb-2 font-figtree italic text-medium">
          Let us know if you have any concerns. We hope to see you there!
          <br />
        </div>
        <div className="font-figtree italic text-medium">
          Love,
          <br />
          The Hack Western 12 Team
        </div>
      </motion.div>

      {/* Back fold */}
      <motion.div
        className="pointer-events-auto absolute bottom-0 right-0 z-0 h-0 w-0"
        style={{
          width: "450px",
          height: "188px",
          background: "linear-gradient(to bottom, #D19AEE -125px, #8F57AD)",
        }}
      />

      {/* Left fold */}
      <motion.div
        className="pointer-events-auto absolute bottom-0 z-10 h-0 w-0"
        style={{
          width: "275px",
          height: "188px",
          background: "linear-gradient(to bottom, #D19AEE, #8F57AD 500px)",
          clipPath: "polygon(0 0, 100% 50%, 0 100%)",
        }}
      />

      {/* Right fold */}
      <motion.div
        className="pointer-events-auto absolute bottom-0 right-0 z-10 h-0 w-0"
        style={{
          width: "275px",
          height: "188px",
          background: "linear-gradient(to bottom, #D19AEE, #8F57AD 500px)",
          clipPath: "polygon(100% 0, 0 50%, 100% 100%)",
        }}
      />

      {/* Bottom fold */}
      <motion.div
        className="pointer-events-auto absolute bottom-0 right-0 z-20 h-0 w-0 shadow-lg"
        style={{
          width: "450px",
          height: "113px",
          background: "linear-gradient(to bottom, #D19AEE, #8F57AD 125px)",
          clipPath: "polygon(50% 0, 0 100%, 100% 100%)",
        }}
      />

        {/* Top fold (flap) */}
        <motion.div
          className="pointer-events-none absolute top-[188px] z-30 h-0 w-0 origin-top shadow-lg"
          animate={{ rotateX: isOpen ? 180 : 0 }}
          transition={{ duration: 0.4, delay: isOpen ? 0 : 0.5 }}
          style={{
            width: "450px",
            height: "113px",
            background: "linear-gradient(to bottom, #8F57AD -75px, #D19AEE 75px)",
            clipPath: "polygon(0 0, 100% 0, 50% 100%)",
            transformStyle: "preserve-3d",
            zIndex: flapZ,
            filter: "drop-shadow(0 4px 4px rgba(0,0,0,0.3))",
          }}
        />
      </div>
      <motion.div 
        animate={{ opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.4 }}
        className="text-heavy font-medium font-figtree bg-white rounded-full w-fit max-w-sm px-4 py-2"
      >
          A message to those new to hacking
      </motion.div>
    </div>
  );
}
