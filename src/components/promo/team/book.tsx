import React from "react";
import Pages from "./pages";
import { LeftCover, RightCover, Bindings } from "./constants";

function Book() {
  return (
    <div className="relative h-[723px] w-[1110px]">
      {/*i love magic numbers*/}
      <div className="absolute h-full w-full">
        <LeftCover />
        <Pages />
        <RightCover />
        <Bindings />
      </div>
    </div>
  );
}

export default Book;
