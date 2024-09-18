import React from "react";

type FieldType = {
  str?: string | null;
  int?: number | null;
};

const PassportField = ({ str, int }: FieldType) => {
  return (
    <div className="font-sans text-base font-normal leading-5 text-[#222734]">
      <p>{str ?? int?.toString()}</p>
    </div>
  );
};

export default PassportField;
