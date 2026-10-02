import type { CSSProperties } from "react";
import Image from "next/image";

import Cloud from "~/components/live/cloud";
import CloudDrift from "~/components/live/clouddrift";
import { WindowFolder } from "~/components/live/window-folder";
import { Button } from "~/components/ui/button";
import { PAST_PROJECTS, type PastProject } from "~/constants/past-projects";

const ASSETS = "/landing/promo/projects";

const POPUP_WIDTH = 280;

type CssVars = CSSProperties & Record<`--${string}`, string>;

/**
 * Figma 402:6142 (desktop) / 585:1083 (mobile). Fixed-aspect stage; the tree
 * group is sized in `cqw` so its window chrome scales with the art.
 */
export function PastProjects() {
  return (
    <section
      id="projects"
      // Pull the following film strip up so it crosses the trunk where the
      // tree image ends, instead of leaving a bare cut-off above the strip.
      className="relative mb-[calc(-2.45vw-15px)] flex flex-col gap-6 pt-12 md:mb-[calc(-4.02vw-15px)] md:block md:pt-0"
    >
      <div className="relative z-10 flex w-full max-w-[341px] flex-col gap-[18px] px-[35px] md:absolute md:left-[11.14%] md:top-[6.6%] md:px-0">
        <div className="flex h-[25px] flex-col md:h-[38px]">
          <h2 className="-mb-[9px] whitespace-nowrap font-cossetteTexte text-[24px] font-bold leading-[1.2] text-heavy md:-mb-[13px] md:text-[36px]">
            Discover past projects
          </h2>
          <p
            aria-hidden
            className="pointer-events-none -scale-y-100 select-none whitespace-nowrap bg-gradient-to-b from-[rgba(0,142,202,0.2)] from-[24.444%] to-[#008eca] to-[65.273%] bg-clip-text font-cossetteTexte text-[24px] font-bold leading-[1.2] text-transparent opacity-20 md:text-[36px]"
          >
            Discover past projects
          </p>
        </div>
        <p className="font-figtree text-[14px] font-medium leading-normal text-medium md:text-[16px]">
          Here is what other students like you have created at Hack Western
        </p>
      </div>

      <div className="relative aspect-[402/544] w-full md:aspect-[1440/1167]">
        <AsciiClouds />
        <TreeScene />
        {PAST_PROJECTS.map((project) => (
          <ProjectFolder key={project.name} project={project} />
        ))}
      </div>
    </section>
  );
}

function AsciiClouds() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="absolute inset-x-0 top-[2%] md:top-[14.27%]">
        <CloudDrift duration={140} delay={-105}>
          <Cloud
            variant="cloud7"
            top="0"
            width="clamp(220px, 40.12vw, 578px)"
            height="clamp(91px, 16.56vw, 238px)"
          />
        </CloudDrift>
      </div>
      <div className="absolute inset-x-0 top-[62%] md:top-[65.83%]">
        <CloudDrift duration={120} delay={-30}>
          <Cloud
            variant="cloud1"
            top="0"
            width="clamp(220px, 40.12vw, 578px)"
            height="clamp(91px, 16.56vw, 238px)"
          />
        </CloudDrift>
      </div>
    </div>
  );
}

/** Tree + hollow "Projects" window, layered so the canopy sits in front of the frame. */
function TreeScene() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-[16.32%] top-[40.06%] aspect-[860.4/875] w-[78.71%] select-none [container-type:inline-size] md:left-[22.05%] md:top-[21.77%] md:w-[59.75%]"
    >
      <TreeImage />

      <div className="absolute left-[2.22%] top-[20.8%] flex h-[3.52%] w-[76.81%] items-center justify-between rounded-t-[0.63cqw] border-[0.105cqw] border-[#9f9f9f] px-[0.627cqw]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${ASSETS}/window-header.png`}
          alt=""
          className="absolute inset-0 size-full max-w-none rounded-t-[0.63cqw] object-cover"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${ASSETS}/window-header-lines.svg`}
          alt=""
          className="absolute left-[-0.105cqw] top-[calc(50%+0.037cqw)] h-[1.987cqw] w-[29.03cqw] max-w-none -translate-y-1/2"
        />
        <div className="relative flex items-center gap-[0.523cqw]">
          {["red", "yellow", "green"].map((color) => (
            <div key={color} className="relative size-[1.255cqw]">
              <div className="absolute inset-[0_-11.11%_-27.78%_-11.11%]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${ASSETS}/traffic-${color}.svg`}
                  alt=""
                  className="block size-full max-w-none"
                />
              </div>
            </div>
          ))}
        </div>
        <p className="relative whitespace-nowrap font-cossetteTexte text-[1.255cqw] leading-normal text-[#626262]">
          Projects
        </p>
        <div className="w-[4.59cqw]" />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${ASSETS}/window-hollow.svg`}
        alt=""
        className="absolute left-[2.2%] top-[24.33%] h-[52.87%] w-[76.88%] max-w-none"
      />

      <div className="absolute inset-x-0 top-0 h-[69.02%] overflow-hidden">
        <div className="absolute inset-x-0 top-0 aspect-[860.4/875]">
          <TreeImage />
          <div className="absolute left-[91.32%] top-[32.2%] h-[6.89%] w-[2.3%] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${ASSETS}/tree-object.png`}
              alt=""
              className="absolute left-[0.05%] top-[1.42%] h-[97.8%] w-[95.41%] max-w-none"
            />
          </div>
        </div>
      </div>

      <div className="absolute left-[4.08%] top-[77.89%] h-[18.06%] w-[41.38%] overflow-hidden">
        <Image
          src={`${ASSETS}/branch.webp`}
          alt=""
          width={1800}
          height={1957}
          sizes="(min-width: 768px) 62vw, 82vw"
          className="absolute left-[0.14%] top-[-352.88%] h-[614.96%] w-[250.99%] max-w-none"
        />
      </div>
    </div>
  );
}

function TreeImage() {
  return (
    <Image
      src={`${ASSETS}/tree.webp`}
      alt=""
      width={1800}
      height={1957}
      sizes="(min-width: 768px) 56vw, 74vw"
      className="absolute left-[0.05%] top-[0.05%] h-[99.96%] w-[93.46%] max-w-none"
    />
  );
}

function ProjectFolder({ project }: { project: PastProject }) {
  const { desktop, mobile } = project.position;
  const vars: CssVars = {
    "--mx": `${mobile.x}%`,
    "--my": `${mobile.y}%`,
    "--dx": `${desktop.x}%`,
    "--dy": `${desktop.y}%`,
  };

  return (
    <div className="contents" style={vars}>
      <WindowFolder
        variant="labelled"
        label={project.name}
        className="absolute left-[var(--mx)] top-[var(--my)] z-20 origin-top -translate-x-1/2 scale-[0.64] md:left-[var(--dx)] md:top-[var(--dy)] md:scale-100"
        windowProps={{
          width: POPUP_WIDTH,
          autoHeight: true,
          className:
            "absolute z-30 left-[clamp(8px,calc(var(--mx)-140px),calc(100%-288px))] top-[max(8px,calc(var(--my)-60px))] md:left-[clamp(8px,calc(var(--dx)-140px),calc(100%-288px))] md:top-[max(8px,calc(var(--dy)-200px))]",
        }}
      >
        <ProjectDetails project={project} />
      </WindowFolder>
    </div>
  );
}

function ProjectDetails({ project }: { project: PastProject }) {
  return (
    <div className="flex w-full flex-col gap-3 py-1 text-left font-figtree text-[13px] leading-snug text-medium">
      <h3 className="font-cossetteTexte text-[22px] font-bold leading-tight tracking-[-0.02em] text-heavy">
        {project.name}
      </h3>
      <p>
        <span className="font-semibold text-heavy">Created by</span>{" "}
        {project.createdBy.join(", ")}
      </p>
      <ul className="flex flex-col gap-2">
        {project.awards.map((award) => (
          <li key={award.name}>
            <p className="font-medium text-heavy">{award.name}</p>
            <p className="text-light">Presented by {award.presentedBy}</p>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-2 pt-1">
        <p className="font-cossetteTexte text-[11px] uppercase tracking-[-0.01em] text-light">
          Hack Western {project.edition} · {project.date}
        </p>
        <Button asChild variant="primary" size="sm">
          <a
            href={project.link}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`More info about ${project.name}`}
          >
            More info
          </a>
        </Button>
      </div>
    </div>
  );
}
