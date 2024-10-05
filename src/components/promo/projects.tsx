import { Button } from "../ui/button";
import { listProjects, type Project } from "~/constants/projects";

const bigListProjects = listProjects.concat(listProjects).concat(listProjects);

const Projects = () => {
  return (
    <div className="max-w-screen relative flex min-h-screen flex-col justify-between overflow-clip bg-[url('/images/projects-bg.svg')] bg-cover pt-40 md:bg-contain">
      <div
        className="mx-auto my-auto mb-20 w-5/6 border-4 border-[#27283D] bg-[#3F3F5C] text-lg text-primary-100 md:w-2/3 2xl:w-1/2 2xl:text-xl 3xl:w-1/3 4xl:text-2xl"
        id="projects"
      >
        <div className="3xl:6xl flex border-b-4 border-[#27283D] font-MagicRetro text-3xl xl:text-4xl">
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="m-auto"
          >
            <path
              d="M23.1751 8.07423L3.45171 27.7977L0.210815 24.5568L19.9343 4.83333H2.55019V0.25H27.7585V25.4583H23.1751V8.07423Z"
              fill="#F8F5FF"
            />
          </svg>
          <p className="w-4/5 border-l-4 border-[#27283D] p-6 3xl:w-5/6">
            inspiring technology leaders
          </p>
        </div>
        <div className="flex border-b-4 border-[#27283D]">
          <svg
            width="48"
            height="36"
            viewBox="0 0 48 36"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="m-auto"
          >
            <path
              d="M48 18L36.6862 29.3138L33.8578 26.4852L42.3432 18L33.8578 9.51472L36.6862 6.6863L48 18ZM5.65686 18L14.1421 26.4852L11.3137 29.3138L0 18L11.3137 6.6863L14.1421 9.51472L5.65686 18ZM19.5769 36H15.3202L28.4232 0H32.6798L19.5769 36Z"
              fill="#F8F5FF"
            />
          </svg>
          <p className="w-4/5 border-l-4 border-[#27283D] p-6 3xl:w-5/6">
            Experience a weekend getaway of incredible speakers, mentors, and
            judges. Build your skills and learn about the future of technology.
          </p>
        </div>
        <div className="flex">
          <svg
            width="42"
            height="40"
            viewBox="0 0 42 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="m-auto"
          >
            <path
              d="M8.20579 28.718L37.4103 28.718V4.10256L4.58975 4.10256L4.58975 31.5592L8.20579 28.718ZM9.62472 32.8205L0.487183 40L0.487183 2.05128C0.487183 0.9184 1.40558 0 2.53846 0L39.4615 0C40.5945 0 41.5128 0.9184 41.5128 2.05128V30.7692C41.5128 31.9022 40.5945 32.8205 39.4615 32.8205H9.62472Z"
              fill="#EEF1F7"
            />
          </svg>
          <div className="w-4/5 border-l-4 border-[#27283D] p-6 3xl:w-5/6">
            Interested in supporting the event? We&apos;d love to get in touch!
            <br />
            <Button
              variant="secondary"
              className="mt-4 border-primary-300 bg-primary-500 text-primary-100 hover:bg-primary-400"
              onClick={() => window.open("mailto:hello@hackwestern.com")}
              asChild
            >
              <a href="mailto:hello@hackwestern.com">Contact Us!</a>
            </Button>
          </div>
        </div>
      </div>
      <div className="mx-auto my-12 w-5/6 text-lg text-primary-100 md:w-2/3 2xl:w-1/2 2xl:text-xl 3xl:w-1/3 4xl:text-2xl">
        <div className="3xl:6xl flex justify-center border-4 border-[#27283D] bg-[#3F3F5C] p-8 font-MagicRetro text-3xl xl:text-4xl">
          check out some past projects!
        </div>
        <div className="absolute h-[100vh] w-5/6 border-x-[16px] border-[#5D528A] px-4 md:w-2/3 2xl:w-1/2 3xl:w-1/3" />
      </div>
      <div className="w-full animate-small-bounce overflow-hidden">
        <div className="-mb-1 flex animate-suitcase-slide gap-8 hover:[animation-play-state:paused] xl:gap-16 2xl:gap-20 3xl:gap-28 4xl:gap-36">
          {
            /* suitcases (projects) */
            bigListProjects.map((project, i) =>
              i % 2 === 0 ? (
                <BlueSuitcase key={i} project={project} />
              ) : (
                <RedSuitcase key={i} project={project} />
              ),
            )
          }
        </div>
        <div className="-py-12 flex overflow-hidden border-y-8 border-violet-500 bg-violet-400">
          <div></div>
          {
            // a lot of gears
            Array.from({ length: 50 }, (_, i) => (
              <Gear key={i} />
            ))
          }
        </div>{" "}
      </div>
    </div>
  );
};

const BlueSuitcase = (props: { project: Project }) => {
  const { title, image, link } = props.project;
  return (
    <div className="mt-6 flex h-fit hover:[animation-play-state:paused] md:animate-wiggle">
      <div className="my-auto -mr-8 h-16 w-16 rounded-md border-8 border-[#26254C]" />
      <a
        href={link}
        target="_blank"
        rel="noreferrer noopener"
        className="w-fit min-w-48 rounded-md border-[12px] border-[#484798] bg-white transition-all hover:scale-[1.02] hover:shadow-[0px_0px_4px_8px_rgba(72,71,152,0.25)] xl:min-w-64 3xl:min-w-80"
      >
        {
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={title} title={title} />
        }
      </a>
      <div className="my-6 flex flex-col justify-between">
        <div className="w-6 rounded-full border-8 border-[#26254C]" />
        <div className="w-6 rounded-full border-8 border-[#26254C]" />
      </div>
    </div>
  );
};

const RedSuitcase = ({ project }: { project: Project }) => {
  const { title, image, link } = project;
  return (
    <div className="flex flex-col hover:[animation-play-state:paused] md:animate-wiggle">
      <div className="mx-auto -mb-5 h-12 w-20 rounded-md border-8 border-[#8E4C5C]" />
      <a
        href={link}
        target="_blank"
        rel="noreferrer noopener"
        className="w-fit min-w-48 rounded-md border-[12px] border-[#C46C81] bg-white transition-all hover:scale-[1.02] hover:shadow-[0px_0px_4px_8px_rgba(196,108,129,0.25)] xl:min-w-64 3xl:min-w-80"
      >
        {
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={title} title={title} />
        }
      </a>
    </div>
  );
};

const Gear = () => {
  return (
    <svg
      width="130"
      height="130"
      viewBox="0 0 130 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="z-50 -my-6 animate-spin-reverse overflow-clip"
    >
      <rect
        x="37"
        y="44"
        width="52"
        height="52"
        rx="26"
        fill="#A19CCA"
        stroke="#777395"
        strokeWidth="8"
      />
      <rect
        x="47.5"
        y="54.5"
        width="31"
        height="31"
        rx="15.5"
        fill="#A19CCA"
        stroke="#777395"
        strokeWidth="7"
      />
      <path
        d="M68.8611 48.1279L67.5905 52.9638"
        stroke="#777395"
        strokeWidth="5"
      />
      <path
        d="M82.6842 58.4806L79.0204 60.6198"
        stroke="#777395"
        strokeWidth="5"
      />
      <path
        d="M50.6404 50.5781L52.9066 53.7584"
        stroke="#777395"
        strokeWidth="5"
      />
      <path
        d="M41.7385 64.7822L44.64 65.5446"
        stroke="#777395"
        strokeWidth="5"
      />
      <path
        d="M80.9092 75.0742L85.2615 76.2178"
        stroke="#777395"
        strokeWidth="5"
      />
      <path
        d="M72.8967 85.8931L75.1629 89.0734"
        stroke="#777395"
        strokeWidth="5"
      />
      <path
        d="M57.8315 88.1387L56.688 92.4909"
        stroke="#777395"
        strokeWidth="5"
      />
      <path
        d="M47.1396 79.6426L43.9593 81.9088"
        stroke="#777395"
        strokeWidth="5"
      />
    </svg>
  );
};

export default Projects;
