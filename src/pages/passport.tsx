import { MajorStamp, HWStamp, SchoolStamp, HackerStamp, SubmittedStamp, LinksStamp } from "~/components/ui/stamp"

export default function Passport() {
    return (
        <>
            <MajorStamp type="Social Science"></MajorStamp>
            <HWStamp returning="newcomer"></HWStamp>
            <SchoolStamp type="University of Toronto"></SchoolStamp>
            <HackerStamp numHackathons="7+"></HackerStamp>
            <SubmittedStamp></SubmittedStamp>
            <LinksStamp></LinksStamp>
        </>
    )
}