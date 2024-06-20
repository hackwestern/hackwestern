import { authRedirect } from "~/utils/redirect";

const Review = () => {
  return <div>Review</div>;
};

export default Review;
export const getServerSideProps = authRedirect;
