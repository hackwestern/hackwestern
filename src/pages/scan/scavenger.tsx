import Scan from "~/components/scan";
import { disabledRedirect } from "~/utils/redirect";

const Scavenger = () => {
  return <Scan />;
};

export default Scavenger;

export const getServerSideProps = disabledRedirect;
