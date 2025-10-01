import Image from "next/image";
import Polaroid from "./polaroid";
import { BackHoles } from "./constants";

export const PAGES = [
  {
    label: "WELCOME",
    labelOffset: 10,
    front: (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <div className="mb-6">
          <Image
            src="/images/organizers/team-photo.png"
            alt="Hack Western 12 Team"
            width={300}
            height={200}
            className="mx-auto rounded-lg shadow-lg"
          />
        </div>
        <div className="space-y-2">
          <h2 className="font-dico text-2xl font-bold text-heavy">
            Hack Western 12
          </h2>
          <p className="font-figtree text-center text-medium" style={{ fontWeight: 700, fontSize: '15px', lineHeight: '100%', letterSpacing: '0%' }}>
            The Dream Team!
          </p>
        </div>
      </div>
    ),
    back: (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <div className="space-y-4">
          <h3 className="font-dico text-xl font-bold text-heavy">
            Welcome to Our Team
          </h3>
          <p className="font-figtree text-medium">
            Meet the passionate students behind Hack Western 12. 
            We're here to make this hackathon an unforgettable experience!
          </p>
        </div>
      </div>
    ),
  },
  {
    label: "CO-DIRECTORS",
    labelOffset: 10,
    front: (
      <div className="flex h-full flex-col items-center justify-start pt-8 pr-8">
        <div className="mb-20">
          <Image
            src="/images/organizers/director_title.png"
            alt="Directors"
            width={455}
            height={101}
            className="block"
          />
        </div>
        <div className="flex items-center">
          <Polaroid
            src="/images/organizers/swathi.png"
            alt="Swathi"
            name="Swathi Thushiyandan"
            role="Director"
            width={166}
            height={166}
          />
        </div>
      </div>
    ),
    back: (
      <div className="relative h-full w-full">
        {/* Background vector */}
        <div className="absolute inset-0">
          <Image
            src="/images/organizers/design_background_1.svg"
            alt="Design background"
            width={421}
            height={517}
            className="h-[83%] w-[90%] object-cover mt-[100px] ml-[25px]"
          />
        </div>
        
        {/* Title letters - DESIGN - Overlapping the vector */}
        <div className="absolute top-0 left-0 z-10">
          <Image 
            src="/images/organizers/design_title.svg" 
            alt="DESIGN" 
            width={290} 
            height={115} 
            className="block h-full w-full mt-[12px] ml-[10px]"
          />
        </div>
        
        {/* Rachel's photo */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="relative">
            <Image
              src="/images/organizers/rachel.jpg"
              alt="Rachel Chen"
              width={170}
              height={170}
              className="clip-octagon"
            />
          </div>
          
          {/* Name and role text */}
          <div className="mt-6 text-center">
            <div className="font-figtree text-center" style={{ fontWeight: 800, fontSize: '30px', lineHeight: '100%', letterSpacing: '0%', color: '#3C204C' }}>
              Rachel Chen
            </div>
            <div className="font-figtree text-sm mt-1" style={{ fontSize: '14px', lineHeight: '1.2', color: '#776780' }}>
              Design Lead
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    label: "DESIGN",
    labelOffset: 126,
    front: (
      <div className="relative h-full w-full overflow-hidden">
        {/* Top Left Vector */}
        <div className="absolute top-0 left-0 -ml-16 -mt-8">
          <Image
            src="/images/organizers/design_background_2.svg"
            alt="Top left vector"
            width={532}
            height={500}
            className="block scale-y-125"
          />
        </div>
        
        {/* Bottom Right Vector */}
        <div className="absolute bottom-0 right-0 -mr-[36px] -mb-[36px]">
          <Image
            src="/images/organizers/design_background_3.svg"
            alt="Bottom right vector"
            width={0}
            height={0}
            className="w-auto h-auto"
          />
        </div>
        
        {/* Top Left Photo Card - Jessica Wang */}
        <div className="absolute top-4 left-4">
          <div className="bg-white" style={{ padding: '18px' }}>
            <Image
              src="/images/organizers/jessica.png"
              alt="Jessica Wang"
              width={150}
              height={150}
              className="block"
            />
          </div>
          <div className="mt-1 text-center" style={{ marginTop: '5px' }}>
            <div className="font-figtree text-center" style={{ fontWeight: 800, fontSize: '30px', lineHeight: '100%', letterSpacing: '0%', color: '#3C204C' }}>
              Jessica Wang
            </div>
            <div className="font-figtree text-sm mt-1" style={{ fontSize: '14px', lineHeight: '1.2', color: '#776780' }}>
              Design Organizer
            </div>
          </div>
        </div>
        
        {/* Bottom Right Photo Card - Anthony Ung */}
        <div className="absolute bottom-4 right-4">
          <div className="bg-white" style={{ padding: '18px' }}>
            <Image
              src="/images/organizers/anthony.jpg"
              alt="Anthony Ung"
              width={150}
              height={150}
              className="block"
            />
          </div>
          <div className="mt-1 text-center" style={{ marginTop: '5px' }}>
            <div className="font-figtree text-center" style={{ fontWeight: 800, fontSize: '30px', lineHeight: '100%', letterSpacing: '0%', color: '#FFFFFF' }}>
              Anthony Ung
            </div>
            <div className="font-figtree text-sm mt-1" style={{ fontSize: '14px', lineHeight: '1.2', color: '#FFFFFF' }}>
              Design Organizer
            </div>
          </div>
        </div>
        
        {/* TODO: Add holes above content - need to implement proper positioning */}
      </div>
    ),
    back: (
      <div>
        text text text
        <Image
          src="/images/organizers/arsalaan.png"
          alt="arsalaan"
          width={96}
          height={96}
          className="mx-auto h-24 w-24"
        />
      </div>
    ),
  },
  {
    label: "EVENTS",
    labelOffset: 195,
    front: (
      <div>
        events 2
        <Image
          src="/images/organizers/ben.png"
          alt="ben"
          width={96}
          height={96}
          className="mx-auto h-24 w-24"
        />
      </div>
    ),
    back: (
      <div>
        marketing
        <Image
          src="/images/organizers/laurel.png"
          alt="cynthia"
          width={96}
          height={96}
          className="mx-auto h-24 w-24"
        />
      </div>
    ),
  },
  {
    label: "MARKETING",
    labelOffset: 264,
    front: (
      <div>
        marketing marketing
        <Image
          src="/images/organizers/dennis.png"
          alt="dennis"
          width={96}
          height={96}
          className="mx-auto h-24 w-24"
        />
      </div>
    ),
    back: (
      <div>
        spon
        <Image
          src="/images/organizers/hunter.png"
          alt="hunter"
          width={96}
          height={96}
          className="mx-auto h-24 w-24"
        />
      </div>
    ),
  },
  {
    label: "SPONSORSHIP",
    labelOffset: 357,
    front: (
      <div>
        spon
        <Image
          src="/images/organizers/jerry.png"
          alt="jerry"
          width={96}
          height={96}
          className="mx-auto h-24 w-24"
        />
      </div>
    ),
    back: (
      <div>
        web
        <Image
          src="/images/organizers/joy.png"
          alt="joy"
          width={96}
          height={96}
          className="mx-auto h-24 w-24"
        />
      </div>
    ),
  },
  {
    label: "WEB",
    labelOffset: 466,
    front: (
      <div>
        web web web
        <Image
          src="/images/organizers/kyle.png"
          alt="kyle"
          width={96}
          height={96}
          className="mx-auto h-24 w-24"
        />
      </div>
    ),
    back: (
      <div>
        bonus page
        <Image
          src="/images/organizers/laura.png"
          alt="laura"
          width={96}
          height={96}
          className="mx-auto h-24 w-24"
        />
      </div>
    ),
  },
] as const;
