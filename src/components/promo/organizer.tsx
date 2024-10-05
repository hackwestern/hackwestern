import Image from "next/image";
import { organizerList } from "~/constants/organizers";

const bigOrganizerList = organizerList
  .concat(organizerList)
  .concat(organizerList);

const Organizer = () => {
  return (
    <div className="bg-gradient-to-b from-[#9D72D5] to-[#5A2F92] pb-16 pt-12 text-3xl lg:py-14">
      <h2 className="mx-auto py-4 text-center text-3xl text-white">
        Brought to you with &#60;3
      </h2>
      <div className="w-full overflow-hidden pt-8">
        <div className="animate-organizer-slide-small -mb-1 ml-24 flex gap-8 p-4 hover:[animation-play-state:paused] md:animate-organizer-slide xl:gap-16 2xl:gap-20 3xl:gap-24 4xl:gap-28">
          {bigOrganizerList.map((organizer, index) =>
            index % 2 === 0 ? (
              <OrganizerPhotoLeft
                key={index}
                name={organizer.name}
                role={organizer.role}
                image={organizer.image}
              />
            ) : (
              <OrganizerPhotoRight
                key={index}
                name={organizer.name}
                role={organizer.role}
                image={organizer.image}
              />
            ),
          )}
        </div>
      </div>
    </div>
  );
};

const OrganizerPhotoLeft = ({
  name,
  role,
  image,
}: {
  name: string;
  role: string;
  image: string;
}) => {
  return (
    <div className="flex min-w-36 -rotate-3 flex-col justify-between bg-white p-2 md:-rotate-6 3xl:min-w-48">
      <>
        <Image
          src={image}
          alt={name}
          width={200}
          height={200}
          className="bg-[#5A2F92]"
        />
        <h3 className="text-center text-sm font-semibold text-black">{name}</h3>
      </>
      <p className="text-center text-sm text-black">{role}</p>
    </div>
  );
};

const OrganizerPhotoRight = ({
  name,
  role,
  image,
}: {
  name: string;
  role: string;
  image: string;
}) => {
  return (
    <div className="flex min-w-36 rotate-3 flex-col justify-between bg-white p-2 md:rotate-6 3xl:min-w-48">
      <>
        <Image
          src={image}
          alt={name}
          width={200}
          height={200}
          className="bg-[#5A2F92]"
        />
        <h3 className="text-center text-sm font-semibold text-black">{name}</h3>
      </>
      <p className="text-center text-sm text-black">{role}</p>
    </div>
  );
};

export default Organizer;
