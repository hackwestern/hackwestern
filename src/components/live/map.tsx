import Image from "next/image";

const Map = () => {
  return (
    <div className="h-full w-fill p-5 sm:p-10 flex flex-col gap-3 mb-8">
      <div className="h-fit w-full rounded-md bg-primary-300 p-4">
        <Image
          src="/images/maps/map.svg"
          alt="map 1"
          width={0}
          height={0}
          className="h-full w-full"
        />
      </div>
      <div className="h-fit w-full rounded-md bg-primary-300 p-4">
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
};

export default Map;
