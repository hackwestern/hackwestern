import { useRouter } from "next/router";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

function NotAuthorizedCard() {
  const router = useRouter();
  return (
    <AlertDialog open={true}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Account Unauthorized</AlertDialogTitle>
          <AlertDialogDescription>
            Uh oh... It looks like you aren&apos;t authorized to access this
            page.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            onClick={() => router.push("/")}
            className="bg-hwprimary-500"
          >
            Return
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default NotAuthorizedCard;
