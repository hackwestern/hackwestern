"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

const Map = () => {
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 10;
  const [scale2, setScale2] = useState(1);
  const [scale3, setScale3] = useState(1);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="font-figtree text-base text-medium">
          This year&apos;s venue will be at Somerville House & Thames Hall!
        </p>
        <p className="font-figtree text-base text-medium">
          <b className="text-heavy">Address:</b> 40 Lambton Dr, London, ON N6G
          2V4
        </p>
      </div>
      <Tabs defaultValue="Floor 2">
        <div className="flex flex-col items-center gap-4 md:flex-row">
          <TabsList>
            <TabsTrigger value="Floor 2">Floor 2 Map</TabsTrigger>
            <TabsTrigger value="Floor 3">Floor 3 Map</TabsTrigger>
          </TabsList>
          <p className="font-figtree text-sm text-medium">
            * Zoom in and out of the map by scrolling / pinching!
          </p>
        </div>
        <TabsContent value="Floor 2">
          <div className="flex h-fit max-h-[calc(100vh-240px)] w-fit flex-col gap-3 overflow-hidden p-5 sm:p-10">
            <motion.img
              src="/map/floor_2.jpg"
              alt="Floor 2 Map"
              drag
              dragMomentum={false}
              onWheel={(e) => {
                e.preventDefault();
                setScale2((prev) => {
                  const next = prev + e.deltaY * -0.001;
                  return Math.min(Math.max(next, MIN_ZOOM), MAX_ZOOM);
                });
              }}
              style={{ scale: scale2 }}
              className="mb-8 h-full w-auto cursor-grab object-contain active:cursor-grabbing"
            />
          </div>
        </TabsContent>
        <TabsContent value="Floor 3">
          <div className="flex h-fit max-h-[calc(100vh-240px)] w-fit flex-col gap-3 overflow-hidden p-5 sm:p-10">
            <motion.img
              src="/map/floor_3.jpg"
              alt="Floor 3 Map"
              drag
              dragMomentum={false}
              onWheel={(e) => {
                e.preventDefault();
                setScale3((prev) => {
                  const next = prev + e.deltaY * -0.001;
                  return Math.min(Math.max(next, MIN_ZOOM), MAX_ZOOM);
                });
              }}
              style={{ scale: scale3 }}
              className="mb-8 h-full w-auto cursor-grab object-contain active:cursor-grabbing"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Map;
