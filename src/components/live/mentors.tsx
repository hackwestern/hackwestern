import Image from "next/image";
import { useState } from "react";
import {
  MentorsList,
  MentorTagsList,
  type Mentor,
  type MentorTags,
} from "~/constants/mentors";
import { DashboardTag } from "~/components/internals/dashboard-tag";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { cn } from "~/lib/utils";

const Mentors = () => {
  const [selectedTags, setSelectedTags] = useState<MentorTags[]>([]);

  const toggle = (tag: MentorTags) =>
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );

  const mentors = MentorsList.filter(
    (mentor) =>
      selectedTags.length === 0 ||
      selectedTags.every((tag) => mentor.tags.includes(tag)),
  );

  return (
    <div className="flex flex-col gap-6 pb-48 font-figtree">
      <div className="flex flex-col gap-3">
        <span className="text-sm font-semibold text-dashboard-text-light">
          Filter by
        </span>
        <div className="flex flex-wrap gap-2">
          {MentorTagsList.map((tag) => (
            <DashboardTag
              key={tag}
              selected={selectedTags.includes(tag)}
              onClick={() => toggle(tag)}
              className="px-3 py-1.5 text-sm"
            >
              {tag}
            </DashboardTag>
          ))}
        </div>
      </div>

      {mentors.length === 0 ? (
        <p className="text-base text-dashboard-text-light">
          No mentors match those filters.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {mentors.map((mentor) => (
            <MentorCard key={mentor.name} mentor={mentor} />
          ))}
        </div>
      )}
    </div>
  );
};

// Matches Figma "Mentors" (1:6287): photo, name, what they're good at, tags
// and a Slack button.
const MentorCard = ({ mentor }: { mentor: Mentor }) => {
  const card = (
    <div
      className={cn(
        "flex h-full flex-col gap-6 rounded-dashboard-lg border border-dashboard-border-faint bg-dashboard-bg-surface p-6 transition-colors",
        mentor.linkedin && "hover:border-dashboard-border-outline",
      )}
    >
      <div className="relative size-20 shrink-0 overflow-hidden rounded-dashboard-sm bg-dashboard-bg-inset">
        {mentor.image && (
          <Image
            src={mentor.image}
            alt=""
            fill
            sizes="80px"
            className="object-cover"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-medium capitalize leading-7 text-dashboard-text-heavy">
            {mentor.name}
          </h2>
          {mentor.skills.length > 0 && (
            <p className="text-sm leading-4 text-dashboard-text-light">
              {mentor.skills.join(" · ")}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          {mentor.tags.map((tag) => (
            <DashboardTag key={tag}>{tag}</DashboardTag>
          ))}
        </div>
      </div>
      <SlackButton href={mentor.slack} />
    </div>
  );

  return mentor.linkedin ? (
    <a
      href={mentor.linkedin}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${mentor.name} on LinkedIn`}
      className="block"
    >
      {card}
    </a>
  ) : (
    card
  );
};

const SlackButton = ({ href }: { href?: string }) => {
  const content = (
    <>
      <span className="relative size-4 overflow-hidden">
        <Image
          src="/live/slack-logo.png"
          alt=""
          width={3840}
          height={2160}
          className="absolute -left-[41.18%] -top-[1.47%] h-[102.71%] w-[182.6%] max-w-none"
        />
      </span>
      Message on Slack
    </>
  );

  if (!href) {
    return (
      <DashboardButton
        variant="outline"
        disabled
        className="w-full opacity-dashboard-disabled"
      >
        {content}
      </DashboardButton>
    );
  }

  return (
    <DashboardButton variant="outline" asChild className="w-full">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        // Don't also open the card's LinkedIn link
        onClick={(event) => event.stopPropagation()}
      >
        {content}
      </a>
    </DashboardButton>
  );
};

export default Mentors;
