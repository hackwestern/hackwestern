import React from "react";
import Avatar from "./avatar";
import PassportField from "./passport-field";
import { api } from "~/utils/api";

export const Passport = () => {
  const { data: application } = api.application.get.useQuery();
  const textStyle = "text-slate-400 font-sans text-xs font-medium leading-5";

  return (
    <div className="2xl:[50vh] 3xl:[40vh] flex h-[70vh] w-1/2 flex-shrink-0 flex-col items-start rounded-[10px] border border-primary-300 xl:h-[60vh]">
      <div className="flex h-1/2 flex-[1_0_0] items-center self-stretch rounded-t-[10px] border-b border-b-[#E3DBF2] bg-gradient-to-l from-[#EFF3FF] via-[#E5E9FF] to-[#ECE9FF]"></div>
      <div className="flex h-1/2 flex-[1_0_0] items-center justify-center gap-10 self-stretch bg-primary-100 p-10">
        <Avatar avatar={application?.avatar} />
        <div className="flex w-1/2 w-full flex-col gap-2">
          <p className={textStyle}>NAME</p>
          <PassportField
            value={!!application?.firstName && !!application?.lastName ? application?.firstName + " " + application?.lastName : ""}
          />
          <p className={textStyle}>AGE</p>
          <PassportField value={application?.age?.toString()} />
          <p className={textStyle}>SCHOOL</p>
          <PassportField value={application?.school} />
          <div className="flex w-full gap-2">
            <div className="w-1/3">
              <p className={textStyle}>YEAR</p>
              <PassportField value={application?.levelOfStudy} />
            </div>
            <div className="w-2/3">
              <p className={textStyle}>MAJOR</p>
              <PassportField value={application?.major} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
