import Image from "next/image";
import Construction from "~/components/live/construction";

const Map = () => {
  return <Construction />;
  /*
  return (
    <div className="w-fill mb-8 flex h-full flex-col gap-3 p-5 sm:p-10">
      <div className="h-fit w-full min-w-[200%] rounded-md bg-primary-300 p-4 md:min-w-full">
        <Image
          src="/images/maps/map.svg"
          alt="map 1"
          width={0}
          height={0}
          className="h-full w-full"
        />
      </div>
      <div className="h-fit w-full min-w-[200%] rounded-md  bg-primary-300 p-4 md:min-w-full">
        <Image
          src="/images/maps/map2.svg"
          alt="map 2"
          width={0}
          height={0}
          className="h-full w-full"
        />
      </div>
      <div className="my-3 border-white" />
    </div>
  );
  */
};

export default Map;
