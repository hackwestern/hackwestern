import { CanvasComponent } from "../canvas/canvas";
import { useState } from "react";
import Image from "next/image";

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
                <Image
                src="/hackwesternmaclogo.svg"
                alt="hackwestern"
                width={95.541}
                height={144.834}
                >
                </Image>
            </div>
            <div data-property-1="Default" className="w-96 h-28 left-[29.33px] top-[49px] absolute origin-top-left rotate-[1.77deg]">
                <div className="w-96 h-20 left-[1.13px] top-[16px] absolute">
           
                </div>
            </div>
        </div>

        

        

        <Image
        src="/notepad.svg"
        alt="notepad"
        width={400}
        height={380}>
            
        </Image>

        <div className="w-96 origin-top-left rotate-[7.65deg] inline-flex flex-col justify-start items-center gap-7">
            <div className="self-stretch flex flex-col justify-start items-center gap-2.5">
                <div className="self-stretch inline-flex justify-center items-center gap-2.5">
                    <div className="w-96 text-center justify-start text-indigo-950 text-2xl font-medium font-['JetBrains_Mono'] uppercase">Sponsor a weekend of inspiration and creation.</div>
                </div>
                <div className="w-96 text-center justify-start text-zinc-500 text-base font-medium font-['Figtree']">Interested in supporting the event?</div>
            </div>
            <div className="px-4 pt-2.5 pb-3 bg-gradient-to-l from-slate-500 to-purple-400 rounded-lg shadow-[0px_2px_4px_0px_rgba(60,32,76,0.20)] border-l border-r border-t border-b-4 border-black/50 inline-flex justify-center items-center gap-2.5">
                <div className="w-4 h-4 relative overflow-hidden">
                    <div className="w-3.5 h-2.5 left-[2.43px] top-[3.57px] absolute outline outline-[1.33px] outline-offset-[-0.67px] outline-white" />
                </div>
                <div className="justify-start text-white text-base font-medium font-['Figtree']">Get in touch</div>
            </div>
        </div>

        </CanvasComponent>
    )
}

export default SponsorSection