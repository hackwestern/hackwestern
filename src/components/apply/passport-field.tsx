import React from "react";

type FieldType = {
  value?: string | null;
};

const PassportField = ({ value }: FieldType) => {
  return value ? (
    <div className="font-sans text-base font-normal leading-5 text-[#222734]">
      <p>{value}</p>
    </div>
  ) : (
    <div className="bg-primary-200 w-fill h-6"/>
  );
};

export default PassportField;
