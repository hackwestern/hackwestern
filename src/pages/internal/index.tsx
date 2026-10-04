// const Internal = () => {
//   return <></>;
// };

// export default Internal;
const Internal = () => null;
export default Internal;

export const getServerSideProps = async () => {
  return {
    redirect: {
      destination: "/internal/dashboard",
      permanent: false,
    },
  };
};
