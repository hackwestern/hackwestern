import Link from "next/link";

type Project = {
  image: string;
  title: string;
  link: string;
};

const Projects = () => {
  return (
    <div className="relative flex min-h-screen flex-col justify-between bg-[url('/images/projects-bg.svg')] bg-cover md:bg-contain">
      <div className="mx-auto my-auto w-1/2 columns-2 bg-[#27283D] 2xl:w-1/3 3xl:w-1/4">
        hi :3
      </div>
      <div className="animate-small-bounce">
        <div className="animate-slide -mb-1 flex gap-8 overflow-clip hover:[animation-play-state:paused] xl:gap-16 2xl:gap-20 3xl:gap-28 4xl:gap-36">
          {
            /* suitcases (projects) */ listProjects.map((project, i) =>
              i % 2 === 0 ? (
                <BlueSuitcase key={i} project={project} />
              ) : (
                <RedSuitcase key={i} project={project} />
              ),
            )
          }
        </div>
        <div className="-py-12 -mb-3 flex overflow-hidden border-y-8 border-violet-500 bg-violet-400">
          <div></div>
          {
            // a lot of gears
            Array.from({ length: 100 }, (_, i) => (
              <Gear key={i} />
            ))
          }
        </div>{" "}
      </div>
    </div>
  );
};

const listProjects: Project[] = [
  {
    image:
      "https://d112y698adiu2z.cloudfront.net/photos/production/software_thumbnail_photos/002/682/847/datas/medium.png",
    title: "SuperStage",
    link: "https://devpost.com/software/superstage",
  },
  {
    image:
      "https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/002/683/856/datas/medium.png",
    title: "Infu",
    link: "https://devpost.com/software/infu",
  },
  {
    image:
      "https://d112y698adiu2z.cloudfront.net/photos/production/software_thumbnail_photos/002/682/566/datas/medium.png",
    title: "AR.cade",
    link: "https://devpost.com/software/ar-cade",
  },
  {
    image:
      "https://d112y698adiu2z.cloudfront.net/photos/production/software_thumbnail_photos/002/682/604/datas/medium.png",
    title: "Credit Crimes",
    link: "https://devpost.com/software/papers-please-clone",
  },
  {
    image:
      "https://d112y698adiu2z.cloudfront.net/photos/production/software_thumbnail_photos/002/758/135/datas/medium.png",
    title: "Pawndr",
    link: "https://devpost.com/software/pawndr-kvlmgj",
  },
  {
    image:
      "https://d112y698adiu2z.cloudfront.net/photos/production/software_thumbnail_photos/002/683/716/datas/medium.png",
    title: "BlockXism",
    link: "https://devpost.com/software/blockxism",
  },
  {
    image:
      "https://d112y698adiu2z.cloudfront.net/photos/production/software_thumbnail_photos/002/683/944/datas/medium.png",
    title: "TrailGuide",
    link: "https://devpost.com/software/trailguide",
  },
  {
    image:
      "https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/002/683/595/datas/medium.png",
    title: "Memory Lane",
    link: "https://devpost.com/software/memory-lane-84kcrl",
  },
  {
    image:
      "https://d112y698adiu2z.cloudfront.net/photos/production/software_thumbnail_photos/002/682/801/datas/medium.gif",
    title: "Harbor.ed",
    link: "https://devpost.com/software/harbor-ed",
  },
];

const BlueSuitcase = (props: { project: Project }) => {
  const { title, image, link } = props.project;
  return (
    <div className="mt-6 flex h-fit animate-wiggle">
      <div className="my-auto -mr-8 h-16 w-16 rounded-md border-8 border-[#26254C]" />
      <Link
        href={link}
        target="_blank"
        className="w-fit min-w-48 rounded-md border-[12px] border-[#484798] bg-white xl:min-w-64 3xl:min-w-80"
      >
        {
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={title} />
        }
      </Link>
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
    <div className="flex flex-col animate-wiggle">
      <div className="mx-auto -mb-5 h-12 w-20 rounded-md border-8 border-[#8E4C5C]" />
      <Link
        href={link}
        target="_blank"
        className="w-fit min-w-48 rounded-md border-[12px] border-[#C46C81] bg-white xl:min-w-64 3xl:min-w-80"
      >
        {
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={title} />
        }
      </Link>
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
      className="z-50 -my-6 animate-[spin_1.25s_linear_infinite] overflow-clip"
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
