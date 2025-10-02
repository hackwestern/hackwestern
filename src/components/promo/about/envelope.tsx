import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";

export default function Envelope() {
  const [envelopeToggled, setEnvelopeToggled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [flapZ, setFlapZ] = useState(20);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleClick = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const newToggleState = !envelopeToggled;
    setEnvelopeToggled(newToggleState);

    if (newToggleState) {
      setIsOpen(true);
      timeoutRef.current = setTimeout(() => {
        setFlapZ(0);
      }, 150);
    } else {
      setIsOpen(false);
      timeoutRef.current = setTimeout(() => {
        setFlapZ(20);
      }, 350);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className="flex rotate-[8deg] flex-col items-center justify-center gap-4">
      <div
        className="pointer-events-none relative -mt-[150px] h-[375px] w-[450px] cursor-pointer "
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        style={{ willChange: isHovered || envelopeToggled ? "transform" : "auto" }}
      >
        {/* Letter */}
        <motion.div
          className="pointer-events-auto absolute bottom-0 left-[15px] z-10 w-[420px] overflow-hidden bg-white p-8"
          initial={{ height: "175px" }}
          animate={{ height: isOpen ? "650px" : "175px" }}
          transition={{
            duration: 0.3,
            delay: 0.15,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
          style={{ willChange: isOpen || isHovered ? "height" : "auto" }}
        >
          <div className="mb-2 font-figtree  text-medium">
            Dear Hacker,
            <br />
          </div>
          <div className="mb-2 font-figtree  text-medium">
            You belong. <br />
          </div>
          <div className="mb-2 font-figtree  text-medium">
            Whether you&apos;re an experienced hacker or have never touched a
            line of code, you belong at Hack Western.
            <br />
          </div>
          <div className="mb-2 font-figtree  text-medium">
            Since the start of Hack Western in 2014, our mission has been to
            build a welcoming and accessible environment for students from all
            backgrounds to learn, build, and pursue their dreams.
            <br />
          </div>
          <div className="mb-2 font-figtree  text-medium">
            If you&apos;ve been wondering if you belong at a hackathon, YOU DO!
            <br />
          </div>
          <div className="mb-2 font-figtree  text-medium">
            Let us know if you have any concerns. We hope to see you there!
            <br />
          </div>
          <div className="font-figtree  text-medium">
            Love,
            <br />
            The Hack Western 12 Team
          </div>
        </motion.div>

        {/* Back fold */}
        <motion.div
          className={
            "pointer-events-auto absolute bottom-0 right-0 z-0 h-0 w-0 shadow-sm" +
            (isOpen || isHovered ? "shadow-lg" : "shadow-sm")
          }
          style={{
            width: "450px",
            height: "188px",
            background: "linear-gradient(to bottom, #AA73C8 -125px, #C189DE)",
          }}
        />

        {/* Left fold */}
        <motion.div
          className="pointer-events-auto absolute bottom-0 z-10 h-0 w-0 shadow-sm"
          style={{
            width: "275px",
            height: "188px",
            background: "linear-gradient(0deg, #8F57AD -100%, #D19AEE 100%)",
            clipPath: "polygon(0 0, 100% 50%, 0 100%)",
            filter: "drop-shadow(0 4px 4px rgba(0,0,0,0.4))",
          }}
        />

        {/* Right fold */}
        <motion.div
          className="pointer-events-auto absolute bottom-0 right-0 z-10 h-0 w-0 shadow-sm"
          style={{
            width: "275px",
            height: "188px",
            background: "linear-gradient(0deg, #8F57AD -100%, #D19AEE 100%)",
            clipPath: "polygon(100% 0, 0 50%, 100% 100%)",
            filter: "drop-shadow(0 4px 4px rgba(0,0,0,0.4))",
          }}
        />

        {/* Bottom fold */}
        <motion.div
          className="pointer-events-auto absolute bottom-0 right-0 z-20 h-0 w-0 shadow-sm"
          style={{
            width: "450px",
            height: "113px",
            clipPath: "polygon(50% 0, 0 100%, 100% 100%)",
            background: "linear-gradient(0deg, #8F57AD -100%, #D19AEE 100%)",
            filter: "drop-shadow(0 0 3.309px rgba(0, 0, 0, 0.25))",
          }}
        />

        {/* Top fold (flap) */}
        <motion.div
          className="pointer-events-none absolute top-[188px] z-30 h-0 w-0 origin-top shadow-sm"
          animate={{ rotateX: isOpen ? 180 : 0 }}
          transition={{
            duration: 0.3,
            delay: isOpen ? 0 : 0.3,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
          style={{
            width: "450px",
            height: "113px",
            background: "linear-gradient(180deg, #8F57AD -150%, #D19AEE 100%)",
            clipPath: "polygon(0 0, 100% 0, 50% 100%)",
            transformStyle: "preserve-3d",
            zIndex: flapZ,
            filter:
              "drop-shadow(0 0 3.309px rgba(0, 0, 0, 0.25)) drop-shadow(0 0 0 1px #8F57AD)",
          }}
        />
      </div>
      <motion.div
        animate={{ opacity: isHovered || isOpen ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        className="w-fit max-w-sm rounded-full bg-white px-4 py-2 font-figtree font-medium text-heavy shadow-sm"
      >
        A message to those new to hacking
      </motion.div>
    </div>
  );
}
