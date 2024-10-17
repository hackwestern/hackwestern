import React from "react";
import Avatar from "./avatar";
import PassportField from "./passport-field";
import { api } from "~/utils/api";
import {
  MajorStamp,
  HackerStamp,
  HWStamp,
  SchoolStamp,
  LinksStamp,
} from "./stamp";
import { type schools } from "~/constants/schools";

export const Passport = () => {
  const { data: application } = api.application.get.useQuery();
  const textStyle = "text-slate-400 font-sans text-xs font-medium leading-5";

  return (
    <div className="z-50 flex w-11/12 flex-col justify-center rounded-[10px] border border-primary-300 lg:w-3/5 2xl:w-2/5 3xl:w-1/3">
      <div className="flex h-1/2 columns-2 flex-col justify-around gap-4 self-stretch rounded-t-[10px] border-b border-b-[#E3DBF2] bg-gradient-to-l from-[#EFF3FF] via-[#E5E9FF] to-[#ECE9FF] py-2.5 xl:py-4 2xl:py-6 3xl:py-8">
        <div className="flex justify-center gap-4 2xl:gap-6 3xl:gap-8">
          {application?.major && <MajorStamp type={application.major} />}
          <HackerStamp numHackathons={application?.numOfHackathons ?? "0"} />
          {application?.attendedBefore !== null && (
            <HWStamp
              returning={application?.attendedBefore ? "returnee" : "newcomer"}
            />
          )}
        </div>
        <div className="flex justify-center gap-4 pb-4 2xl:gap-6 2xl:pb-6 3xl:gap-8 3xl:pb-8">
          {application?.school && (
            <SchoolStamp
              type={application.school as (typeof schools)[number]}
            />
          )}
          {application?.resumeLink && <LinksStamp />}
        </div>
      </div>
      <div className="flex h-1/2 flex-[1_0_0] items-center justify-center gap-10 self-stretch rounded-b-[10px] bg-primary-100 p-10">
        <Avatar avatar={application?.avatar} selection={false} />
        <div className="flex w-full flex-col gap-2">
          <p className={textStyle}>NAME</p>
          <PassportField
            value={
              !!application?.firstName && !!application?.lastName
                ? application?.firstName + " " + application?.lastName
                : ""
            }
          />
          <p className={textStyle}>AGE</p>
          <PassportField value={application?.age?.toString()} />
          <p className={textStyle}>SCHOOL</p>
          <PassportField value={application?.school} />
        </div>
      </div>
    </div>
  );
};
