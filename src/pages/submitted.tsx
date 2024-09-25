import type { GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { ApplyNavbar } from "~/components/apply/navbar";
import { Button } from "~/components/ui/button";
import { api } from "~/utils/api";
import { authOptions } from "~/server/auth";
import { db } from "~/server/db";

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const session = await getServerSession(context.req, context.res, authOptions);

    if (!session) {
      return {
        redirect: {
          destination: "/login",
          permanent: false,
        },
      };
    } 

    const application = await db.query.applications.findFirst({
        where: (application, { eq }) => eq(application?.userId, session.user.id),
    })

    if (application?.status === "IN_PROGRESS") {
        return {
            redirect: {
                destination: "/apply?step=review",
                permanent: false
            }
        }
    }

    return {props: {}}

};

export default function Submitted() {
    const {data: application} = api.application.get.useQuery();
    return (
        <div className="flex flex-col h-svh">
            <ApplyNavbar></ApplyNavbar>
            <div className="flex bg-hw-linear-gradient-day flex-grow items-center justify-center">
                <div className="flex gap-2 flex-col border-primary-300 bg-violet-100 rounded-lg max-w-screen-sm items-start p-10 ">
                    <h2 className="font-DM_Sans text-2xl font-bold">Submitted! ✈️</h2>
                    <h4 className="font-DM_Sans text-xl font-medium">Thanks for applying, {application?.firstName}.</h4>
                    <p className="font-DM_Sans">You&apos;ll hear back from us about your status in a few weeks. In the meantime, check out your Hacker Dashboard!</p>
                    <Button asChild variant="primary" className="mt-2.5">
                        <Link href="/dashboard">Go to Hacker Dashboard</Link>
                    </Button>
                </div>
            </div>
        </div>
    )
}