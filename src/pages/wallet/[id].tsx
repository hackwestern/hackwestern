// page for where wallet qr code goes to
"use client"
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Spinner } from "../../components/loading-spinner";
import { api } from '~/utils/api';


// Where the Wallet QR Code Goes to 
export default function Wallet() {
  const router = useRouter();
  const { id: _id } = router.query;

  const [loading, setLoading] = useState(true);
  // user state not used in UI currently
  // const [user, setUser] = useState<string | null>(null);
  const [userType, _setUserType] = useState<string>("hacker");
  //const { data: application } = api.application.getById.useQuery({ applicantId: id as string });
  const { data: application } = api.application.get.useQuery();

  useEffect(() => {
    // Use a non-async callback for setTimeout to avoid returning a Promise
    const writeUser = () => {
      setTimeout(() => {
        setLoading(false);
        console.log("BI There ");
        console.log(application);
      }, 1000);
    };

    writeUser(); // maybe want to record we met this person via url id and stored user id
  }, [application]);

  // Display Loading Screen
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen border-2 border-red-500">
        <Spinner isLoading className="w-12 h-12 mb-4 fill-primary-600 text-gray-200" />
        <span className="text-lg text-gray-500">Loading your wallet...</span>
      </div>
    );
  }

  // Display Event Page to Sign User If User is Organizer
  if (userType === "organizer") {
    // event page for organizer to add people to the event with the person reloaded 
    return (
      <div>
        <h1>Event Page for organizer</h1>
      
      </div>
    )
  }

  // Display Socials If User is Attendee (Could be Sick for Networking and Sponsors)
  return (
    <div>
      <h1>cool thing to see that we can update adn make it look nice hacker</h1>
      {application?.firstName}
      {application?.lastName}
      {application?.major}
      {application?.phoneNumber}
      {application?.githubLink}
      {application?.linkedInLink}
      {application?.resumeLink}

    </div>
  )
}