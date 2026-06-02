// import Head from "next/head";
// import { useSearchParams } from "next/navigation";
// import React from "react";
// import { motion, useAnimation } from "framer-motion";
// import { type ApplyStepFull, applySteps } from "~/constants/apply";
// import { ApplyMenu } from "~/components/apply/menu";
// import { colors } from "~/constants/avatar";
// import { api } from "~/utils/api";
// import { notVerifiedRedirectDashboard } from "~/utils/redirect";
// import CanvasBackground from "~/components/canvas-background";
// import CharacterIcon from "~/components/dashboard/CharacterIcon";
// import SubmittedDisplay from "~/components/dashboard/SubmittedDisplay";
// import { type CanvasPaths } from "~/types/canvas";
import { type GetServerSidePropsContext } from "next";
// import { getServerSession } from "next-auth";
// import { authOptions } from "~/server/auth";
// import { db } from "~/server/db";

// function getApplyStep(stepValue: string | null): ApplyStepFull | null {
//   return applySteps.find((s) => s.step === stepValue) ?? null;
// }

// const Dashboard = () => {
//   const { data: application } = api.application.get.useQuery({
//     fields: [
//       "firstName",
//       "lastName",
//       "avatarColour",
//       "avatarFace",
//       "avatarLeftHand",
//       "avatarRightHand",
//       "avatarHat",
//       "school",
//       "major",
//       "attendedBefore",
//       "numOfHackathons",
//       "githubLink",
//       "linkedInLink",
//       "otherLink",
//       "resumeLink",
//       "canvasData",
//     ],
//   });

//   const selectedColor = colors.find(
//     (c) => c.name === (application?.avatarColour ?? "green"),
//   );

//   type CanvasData = {
//     paths: CanvasPaths;
//     timestamp: number;
//     version: string;
//   };

//   const canvasData = application?.canvasData as CanvasData | null | undefined;
//   const pathStrings =
//     canvasData?.paths?.map((path) =>
//       path.reduce((acc, point, index) => {
//         if (index === 0) return `M ${point[0]} ${point[1]}`;
//         return `${acc} L ${point[0]} ${point[1]}`;
//       }, ""),
//     ) ?? [];

//   const searchParams = useSearchParams();
//   const applyStep = React.useMemo(
//     () => getApplyStep(searchParams.get("step")),
//     [searchParams],
//   );

//   const step = applyStep?.step ?? null;

//   // server-side redirect handles navigation to /apply for incomplete apps
//   // keep animation controls
//   const controls = useAnimation();

//   // entrance animation on mount
//   React.useEffect(() => {
//     void controls.start({ opacity: 1, transition: { duration: 0.5 } });
//   }, [controls]);

//   // no client-side loading overlay; navigation is server-side

//   return (
//     <>
//       <Head>
//         <title>Hack Western</title>
//         <meta
//           name="description"
//           content="Hack Western: One of Canada's largest annual student-run hackathons based out of Western University in London, Ontario."
//         />
//         <link rel="icon" href="/favicon.ico" />
//       </Head>
//       <motion.main
//         className="bg-hw-linear-gradient-day flex h-screen flex-col items-center overscroll-contain bg-primary-50 md:overflow-y-hidden"
//         key={"dashboard-page"}
//         initial={{ opacity: 0 }}
//         animate={controls}
//         exit={{ opacity: 0 }}
//       >
//         {/* Mobile View */}
//         <div className="relative z-10 flex h-screen w-screen flex-col md:hidden">
//           {/* Mobile Header */}
//           <div className="fixed z-[99] flex h-16 w-full items-center justify-between bg-white px-4 shadow-sm">
//             <div className="h-8 w-8" />
//             <h1 className="font-figtree text-sm font-semibold text-heavy">
//               Home
//             </h1>
//             <div className="flex h-8 w-8 items-center justify-center">
//               <ApplyMenu step={step} />
//               <CharacterIcon />
//             </div>
//           </div>

//           {/* Mobile Content */}
//           <div className="flex h-svh flex-col">
//             <div className="bg-hw-linear-gradient-day relative flex flex-grow items-center justify-center">
//               <CanvasBackground />
//               <SubmittedDisplay
//                 application={application}
//                 pathStrings={pathStrings}
//                 selectedColor={selectedColor}
//               />
//             </div>
//           </div>
//         </div>
//         {/* End of Mobile View */}

//         {/* Desktop View */}
//         {
//           <div className="hidden h-svh w-svw flex-grow flex-col md:flex">
//             <div className="bg-hw-linear-gradient-day relative flex flex-grow items-center justify-center">
//               <div className="absolute right-6 top-6 z-[100] flex items-center gap-4">
//                 <CharacterIcon />
//               </div>
//               <CanvasBackground />
//               <SubmittedDisplay
//                 application={application}
//                 pathStrings={pathStrings}
//                 selectedColor={selectedColor}
//               />
//             </div>
//           </div>
//         }
//         {/* End of Desktop View */}
//       </motion.main>
//     </>
//   );
// };

// export default Dashboard;

// Temporary placeholder component - redirect happens in getServerSideProps
const Dashboard = () => null;
export default Dashboard;

export const getServerSideProps = async (
  context: GetServerSidePropsContext,
) => {
  return {
    redirect: {
      destination: "/live",
      permanent: false,
    },
  };
};
