import { motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';

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
        className="relative w-[450px] h-[375px] -mt-[150px] rotate-[8deg]"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        >
            {/* Letter */}
            <motion.div
                className="absolute bottom-0 left-[15px] w-[420px] bg-white overflow-hidden p-8 z-10"
                initial={{ height: '90px' }}
                animate={{ height: isOpen ? '650px' : '90px' }}
                transition={{ duration: 0.4, delay: 0.2 }}
            >
                <div className='text-medium italic font-figtree mb-2'>
                    Dear Hacker,<br />
                </div>
                <div className='text-medium italic font-figtree mb-2'>
                    You belong. <br />
                </div>
                <div className='text-medium italic font-figtree mb-2'>
                    Whether you&apos;re an experienced hacker or have never touched a line of code, you belong at Hack Western. 
                    <br />
                </div>
                <div className='text-medium italic font-figtree mb-2'>
                    Since the start of Hack Western in 2014, our mission has been to build a welcoming and accessible environment for students from all backgrounds to learn, build, and pursue their dreams.
                    <br />
                </div>
                <div className='text-medium italic font-figtree mb-2'>
                    If you&apos;ve been wondering if you belong at a hackathon, YOU DO!
                    <br />
                </div>
                <div className='text-medium italic font-figtree mb-2'>
                    Let us know if you have any concerns. We hope to see you there!
                    <br />
                </div>
                <div className='text-medium italic font-figtree'>
                    Love,
                    <br />
                    The Hack Western 12 Team
                </div>
            </motion.div>

            {/* Back fold */}
            <motion.div
                className="absolute right-0 bottom-0 w-0 h-0 z-0"
                style={{
                    width: "450px",
                    height: "188px",
                    background: "linear-gradient(to bottom, #D19AEE -125px, #8F57AD)",
                }}
            />

            {/* Left fold */}
            <motion.div
                className="absolute bottom-0 w-0 h-0 z-10"
                style={{
                    width: "275px",
                    height: "188px",
                    background: "linear-gradient(to bottom, #D19AEE, #8F57AD 500px)",
                    clipPath: "polygon(0 0, 100% 50%, 0 100%)",
                }}
            />

            {/* Right fold */}
            <motion.div
                className="absolute right-0 bottom-0 w-0 h-0 z-10"
                style={{
                    width: "275px",
                    height: "188px",
                    background: "linear-gradient(to bottom, #D19AEE, #8F57AD 500px)",
                    clipPath: "polygon(100% 0, 0 50%, 100% 100%)",
                }}
            />
            
            {/* Bottom fold */}
            <motion.div
                className="absolute right-0 bottom-0 w-0 h-0 z-20 shadow-lg"
                style={{
                    width: "450px",
                    height: "113px",
                    background: "linear-gradient(to bottom, #D19AEE, #8F57AD 125px)",
                    clipPath: "polygon(50% 0, 0 100%, 100% 100%)",
                }}
            />

            {/* Top fold (flap) */}
            <motion.div
                className="absolute top-[188px] w-0 h-0 origin-top z-30 shadow-lg"
                animate={{ rotateX: isOpen ? 180 : 0 }}
                transition={{ duration: 0.7 }}
                style={{
                    width: "450px",
                    height: "113px",
                    background: "linear-gradient(to bottom, #8F57AD -75px, #D19AEE 75px)",
                    clipPath: "polygon(0 0, 100% 0, 50% 100%)",
                    transformStyle: 'preserve-3d', 
                    zIndex: flapZ,
                    filter: 'drop-shadow(0 4px 4px rgba(0,0,0,0.3))',
                }}
            />
        </div>
    );
}
