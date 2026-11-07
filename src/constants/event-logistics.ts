import {
  CircleCheck,
  CircleHelp,
  Luggage,
  MessageCircle,
  NotebookText,
  Phone,
  type LucideIcon,
} from "lucide-react";

export type LogisticsStep = {
  /** Markdown file in /public/live/logistics (none for the packing list) */
  slug: string;
  /** Overview card and Back/Next label */
  navTitle: string;
  /** Heading shown above the page content */
  pageTitle: string;
  icon: LucideIcon;
};

// Figma "Event Logistics" has six pages (the scavenger hunt page is gone).
// `step` in the URL is the 1-based index into this list.
export const logisticsSteps: LogisticsStep[] = [
  {
    slug: "packing-list",
    navTitle: "Packing List",
    pageTitle: "Packing List",
    icon: Luggage,
  },
  {
    slug: "communications",
    navTitle: "Communications",
    pageTitle: "Communications",
    icon: MessageCircle,
  },
  {
    slug: "housekeeping",
    navTitle: "Housekeeping",
    pageTitle: "Housekeeping",
    icon: NotebookText,
  },
  {
    slug: "general-project-rules",
    navTitle: "Project Rules",
    pageTitle: "General & Project Rules",
    icon: CircleCheck,
  },
  {
    slug: "contact-us",
    navTitle: "Contact Us",
    pageTitle: "Contact Us",
    icon: Phone,
  },
  {
    slug: "faq",
    navTitle: "FAQ",
    pageTitle: "Frequently Asked Questions",
    icon: CircleHelp,
  },
];

export const CONTACT_US_STEP = 5;
export const FAQ_STEP = 6;

export const logisticsHref = (step: number) =>
  `/live?tab=event-logistics&step=${step}`;
