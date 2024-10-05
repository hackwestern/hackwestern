import React from "react";

type FieldType = {
  value: string | null | undefined;
};

const PassportField = ({ value }: FieldType) => {
  return value ? (
    <div className="font-sans text-base font-normal leading-5 text-slate-800">
      <p>{value}</p>
    </div>
  ) : (
    <div className="w-fill h-6 bg-primary-200" />
  );
};

export default PassportField;
