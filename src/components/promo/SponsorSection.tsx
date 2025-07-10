import { CanvasComponent } from "../canvas/canvas";
import { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { Button } from "../ui/button";
import { Mail } from "lucide-react";

function SponsorSection(){

    return(
        <CanvasComponent>
            <div className="w-[794px] inline-flex flex-col justify-start items-center gap-6">
                <div className="self-stretch h-5 text-center justify-start text-zinc-500 text-base font-medium font-['JetBrains_Mono'] uppercase">Our sponsors</div>
                <div className="self-stretch flex flex-col justify-start items-start gap-3">
                    <div className="self-stretch text-center justify-start text-indigo-950 text-3xl font-medium font-['Dico']">Our sponsors make Hack Western possible.</div>
                    <div className="self-stretch text-center justify-start text-zinc-500 text-base font-medium font-['Figtree']">Thank you to the organizations that support our mission.</div>
                </div>
            </div>

                    <div className="w-[872.27px] h-[626.11px] relative origin-top-left rotate-[-1.77deg] bg-gradient-to-b from-gray-200 to-zinc-400 rounded-3xl shadow-[0px_3.8216559886932373px_7.643311977386475px_0px_rgba(0,0,0,0.25)] shadow-[inset_0px_-1.9108279943466187px_11.464967727661133px_0px_rgba(0,0,0,0.40)]">
            <div className="w-24 h-36 left-[386.49px] top-[239.58px] absolute">
                <motion.img
                src="/hackwesternmaclogo.svg"
                alt="hackwestern"
                width={95.541}
                height={144.834}
                draggable="false"
                />
            </div>
            <div data-property-1="Default" className="w-96 h-28 left-[29.33px] top-[49px] absolute origin-top-left rotate-[1.77deg]">
                <div className="w-96 h-20 left-[1.13px] top-[16px] absolute">
           
                </div>
            </div>
        </div>
        
        <motion.img
        src="/notepad.svg"
        alt="notepad"
        width={400}
        height={380}
        draggable="false"
        />

        <div className="w-96 origin-top-left rotate-[7.65deg] inline-flex flex-col justify-start items-center gap-7">
            <div className="self-stretch flex flex-col justify-start items-center gap-2.5">
                <div className="self-stretch inline-flex justify-center items-center gap-2.5">
                    <div className="w-96 text-center justify-start text-indigo-950 text-2xl font-medium font-['JetBrains_Mono'] uppercase">Sponsor a weekend of inspiration and creation.</div>
                </div>
                <div className="w-96 text-center justify-start text-zinc-500 text-base font-medium font-['Figtree']">Interested in supporting the event?</div>
            </div>
                <div className="w-4 h-4 relative overflow-hidden">
                </div>
                <Button
                      variant="primary"
                      className="w-40 pt-1 pr-2 pl-2 pb-1 gap-1"                      
                      type="submit"
                >
                <Mail className="ml-2 h-6 w-6" />
                    Get in touch
                
                </Button>
            </div>

        </CanvasComponent>
    )
}

export default SponsorSection