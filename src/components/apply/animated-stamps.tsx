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
  const { data } = api.application.get.useQuery();
  return (
    <motion.div
      layout
      transition={{ layout: { duration: 0.28, ease: "easeInOut" } }}
      className="mx-auto hidden h-full w-full justify-around xl:flex xl:flex-col 2xl:w-64 2xl:pb-12"
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div key="major" layout {...itemAnim}>
          <MajorStamp type={data?.major} />
        </motion.div>

        <motion.div key="school" layout {...itemAnim}>
          <SchoolStamp type={data?.school} />
        </motion.div>

        {data?.githubLink &&
          data?.linkedInLink &&
          data?.otherLink &&
          data?.resumeLink && (
            <motion.div key="links" layout {...itemAnim}>
              <LinksStamp />
            </motion.div>
          )}
      </AnimatePresence>
    </motion.div>
  );
}

export function MobileStampGroup() {
  const { data } = api.application.get.useQuery();

  return (
    <motion.div
      layout
      transition={{ layout: { duration: 0.28, ease: "easeInOut" } }}
      className="relative z-10 flex flex-wrap items-center justify-center gap-4 p-4"
    >
      <AnimatePresence initial={false} mode="popLayout">
        {data?.avatarColour && (
          <div className="scale-90">
            <motion.div
              key="mobile-avatar"
              layout
              {...itemAnim}
              className=" h-36 w-36 self-center"
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
          </div>
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
  const { data } = api.application.get.useQuery();

  return (
    <motion.div
      layout
      transition={{ layout: { duration: 0.28, ease: "easeInOut" } }}
      className="hidden h-full w-full justify-around xl:flex xl:flex-col 2xl:mx-auto 2xl:w-64 2xl:pb-12"
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
          <div className="scale-50 self-center ">
            {data?.avatarColour && (
              <AvatarDisplay
                avatarColour={data?.avatarColour}
                avatarFace={data?.avatarFace}
                avatarLeftHand={data?.avatarLeftHand}
                avatarRightHand={data?.avatarRightHand}
                avatarHat={data?.avatarHat}
                size="lg"
              />
            )}
          </div>
        </motion.div>

        <motion.div key="hacker-desktop" layout {...itemAnim}>
          <HackerStamp numHackathons={data?.numOfHackathons} />
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

export default LeftStampColumn;
