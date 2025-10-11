import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MajorStamp,
  SchoolStamp,
  HackerStamp,
  HWStamp,
  LinksStamp,
} from "~/components/apply/stamp";
import { AvatarDisplay } from "~/components/apply/avatar-display";
import { api } from "~/utils/api";

const itemAnim = {
  initial: { opacity: 0, y: -6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 6 },
  transition: { duration: 0.14 },
};

export function LeftStampColumn() {
  const { data } = api.application.get.useQuery({
    fields: [
      "major",
      "school",
      "githubLink",
      "linkedInLink",
      "otherLink",
      "resumeLink",
    ],
  });

  return (
    <motion.div
      layout
      transition={{ layout: { duration: 0.28, ease: "easeInOut" } }}
      className="mx-auto hidden h-lg w-36 justify-around lg:flex lg:w-40 lg:flex-col 2xl:h-[65vh] 2xl:w-48 2xl:pb-12 3xl:h-[60vh] 3xl:w-64 4xl:w-80"
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div key="major" className="ml-4" layout {...itemAnim}>
          <MajorStamp type={data?.major} />
        </motion.div>

        <motion.div
          key="school"
          className="-ml-4 mr-4 pl-4"
          layout
          {...itemAnim}
        >
          <SchoolStamp type={data?.school} />
        </motion.div>

        {data?.githubLink &&
          data?.linkedInLink &&
          data?.otherLink &&
          data?.resumeLink && (
            <motion.div key="links" className="ml-4" layout {...itemAnim}>
              <LinksStamp />
            </motion.div>
          )}
      </AnimatePresence>
    </motion.div>
  );
}

export function MobileStampGroup() {
  const { data } = api.application.get.useQuery({
    fields: [
      "avatarColour",
      "avatarFace",
      "avatarLeftHand",
      "avatarRightHand",
      "avatarHat",
      "school",
      "major",
      "attendedBefore",
      "numOfHackathons",
      "githubLink",
      "linkedInLink",
      "otherLink",
      "resumeLink",
    ],
  });

  return (
    <motion.div
      layout
      transition={{ layout: { duration: 0.28, ease: "easeInOut" } }}
      className="relative z-10 flex flex-wrap items-center justify-center gap-4 p-4"
    >
      <AnimatePresence initial={false} mode="popLayout">
        {data?.avatarColour && (
          <motion.div
            key="mobile-avatar"
            layout
            {...itemAnim}
            className="-mr-1 ml-3 mt-4 h-36 w-36 self-center"
          >
            <AvatarDisplay
              avatarColour={data?.avatarColour}
              avatarFace={data?.avatarFace}
              avatarLeftHand={data?.avatarLeftHand}
              avatarRightHand={data?.avatarRightHand}
              avatarHat={data?.avatarHat}
              size="sm"
            />
          </motion.div>
        )}

        <div className="scale-[0.8]">
          <motion.div key="mobile-school" layout {...itemAnim}>
            <SchoolStamp type={data?.school} />
          </motion.div>
        </div>

        <div className="scale-[0.8]">
          <motion.div key="mobile-major" layout {...itemAnim}>
            <MajorStamp type={data?.major} />
          </motion.div>
        </div>

        {data?.attendedBefore !== undefined &&
          data?.attendedBefore !== null && (
            <div className="scale-[0.8]">
              <motion.div key="mobile-hw" layout {...itemAnim}>
                <HWStamp
                  returning={data?.attendedBefore ? "returnee" : "newcomer"}
                />
              </motion.div>
            </div>
          )}

        <div className="scale-[0.8]">
          <motion.div key="mobile-hacker" layout {...itemAnim}>
            <HackerStamp numHackathons={data?.numOfHackathons} />
          </motion.div>
        </div>

        {data?.githubLink &&
          data?.linkedInLink &&
          data?.otherLink &&
          data?.resumeLink && (
            <div className="scale-[0.8]">
              <motion.div key="mobile-links" layout {...itemAnim}>
                <LinksStamp />
              </motion.div>
            </div>
          )}
      </AnimatePresence>
    </motion.div>
  );
}

export function RightStampColumn() {
  const { data } = api.application.get.useQuery({
    fields: [
      "attendedBefore",
      "avatarColour",
      "avatarFace",
      "avatarLeftHand",
      "avatarRightHand",
      "avatarHat",
      "numOfHackathons",
      "school",
      "major",
    ],
  });

  return (
    <motion.div
      layout
      transition={{ layout: { duration: 0.28, ease: "easeInOut" } }}
      className="mx-auto hidden h-lg w-36 lg:flex lg:w-40 lg:flex-col lg:items-end lg:justify-evenly 2xl:h-[65vh] 2xl:w-48 2xl:pb-12 3xl:h-[60vh] 3xl:w-64 4xl:w-80"
    >
      <AnimatePresence initial={false} mode="popLayout">
        {data?.attendedBefore !== undefined && data?.attendedBefore !== null ? (
          <motion.div key="hw-desktop" layout {...itemAnim}>
            <HWStamp
              returning={data?.attendedBefore ? "returnee" : "newcomer"}
            />
          </motion.div>
        ) : null}

        <motion.div key="avatar-desktop" layout {...itemAnim}>
          <div className="mr-8 scale-90 self-center ">
            {data?.avatarColour && (
              <AvatarDisplay
                avatarColour={data?.avatarColour}
                avatarFace={data?.avatarFace}
                avatarLeftHand={data?.avatarLeftHand}
                avatarRightHand={data?.avatarRightHand}
                avatarHat={data?.avatarHat}
                size="sm"
              />
            )}
          </div>
        </motion.div>

        <motion.div
          key="hacker-desktop"
          className="mr-8 lg:mr-16"
          layout
          {...itemAnim}
        >
          <HackerStamp numHackathons={data?.numOfHackathons} />
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

export default LeftStampColumn;
