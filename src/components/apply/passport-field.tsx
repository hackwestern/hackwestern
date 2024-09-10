import React from "react";
import { levelOfStudy, major } from "../../server/db/schema";

type FieldType = {
  str?: String | null;
  int?: number | null;
};

const PassportField = ({ str, int }: FieldType) => {
  return (
    <div className="font-sans text-base font-normal leading-5 text-[#222734]">
      <p>{str || int?.toString()}</p>
    </div>
  );
};

export default PassportField;
