const Internal = () => {
  return <></>;
};

export default Internal;
export const getServerSideProps = async () => {
  return {
    redirect: {
      destination: "/internal/dashboard",
    },
  };
};
