import React from 'react';
import { applicationSaveSchema } from '~/schemas/application';
import Avatar from './avatar';
import PassportField from './passport-field';
//import MajorStamp from './majorstamp';
//import HWStamp from './hwstamp';
//import SchoolStamp from './schoolstamp';
//import HackerStamp from './hackerstamp';
//import SubmittedStamp from './submittedstamp';
//import LinksStamp from './linksstamp';

import { z } from 'zod';

type Application = {
    application: z.infer<typeof applicationSaveSchema>;
}

const Passport = ( {application}: Application ) => {
  const textStyle = "text-[#8E93A5] font-sans text-xs font-medium leading-5";

  return (
    <div className="flex w-[570px] h-[626px] flex-col items-start flex-shrink-0 rounded-[10px] border border-[#E3DBF2]">
        <div className="flex items-center flex-[1_0_0] self-stretch rounded-t-[10px] border-b border-b-[#E3DBF2] bg-gradient-to-l from-[#EFF3FF] via-[#E5E9FF] to-[#ECE9FF]">
            {/* <MajorStamp type={}/> */}
            {/* <HWStamp type={}/> */}
            {/* <SchoolStamp type={}/> */}
            {/* <HackerStamp type={}/> */}
            {/* <SubmittedStamp type={}/> */}
            {/* <LinksStamp type={}/> */}
        </div>
        <div className="flex p-10 justify-center items-center gap-10 flex-[1_0_0] self-stretch bg-[#F8F5FF]">
            <Avatar avatar={application.avatar}/>
            <div className="flex flex-col gap-2">
                <p className={textStyle}>NAME</p>
                <PassportField str={application.firstName + ' ' + application.lastName}/>
                <p className={textStyle}>AGE</p>
                <PassportField int={application.age}/>
                <p className={textStyle}>SCHOOL</p>
                <PassportField str={application.school}/>
                <p className={textStyle}>YEAR</p>
                <PassportField str={application.levelOfStudy}/>
                <p className={textStyle}>MAJOR</p>
                <PassportField str={application.major}/>
            </div>
        </div>
    </div>
  );
};

export default Passport;