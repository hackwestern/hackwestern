export type FaqType = {
  question: string;
  answer: string;
};

export const PROMO_FAQ: readonly [
  FaqType,
  FaqType,
  FaqType,
  FaqType,
  FaqType,
  FaqType,
  FaqType,
  FaqType,
  FaqType,
  FaqType,
  FaqType,
  FaqType,
] = [
  {
    question: "What if it's my first hackathon?",
    answer:
      "The first time is always intimidating, but with support from mentors, beginner-friendly workshops, and a large network of passionate students, we're confident that you'll find your stride and have a great weekend.\nHack Western is a hackathon where individuals from all disciplines, majors, and backgrounds are encouraged to participate.",
  },
  {
    question: "When do hacker applications open?",
    answer:
      "We will be announcing hacker applications in early October. Follow our social media and sign up for our mailing list by pre-registering here to be the first to find out.",
  },
  {
    question: "How many people do I need in a team?",
    answer:
      "Hackers can be in teams of up to 4 people, which means you could also solo hack if you wish. You do not need to tell us who your team members are, simply add them to your Devpost submission before the deadline.",
  },
  {
    question: "What workshops and activities will there be?",
    answer:
      "You won't be hacking for 36 hours straight, as there will be many workshops and activities you can participate in during the event as well as the week leading up to it. Last year, our workshops included topics like creating chrome extensions, building voice apps, pitching your hackathon project, recruiting, and more. Our full schedule will be released closer to the event!",
  },
  {
    question: "When can I start hacking?",
    answer:
      "Hacking begins at 9pm on Friday, November 21st, 2025 and ends at 9am on Sunday, November 23rd, 2025. All code written for Hack Western must be written within this timeframe, with the exception of code taken from public and open source libraries, APIs, or tutorials. Any projects found to be worked on outside of this time frame will be disqualified from judging.",
  },
  {
    question: "What is a hackathon?",
    answer:
      "A hackathon is an event designed for students to experiment with tech and bring a project idea to life. At Hack Western, participants will collaborate in teams of up to four to build web, mobile, and hardware projects. Students will get the opportunity to receive mentorship from industry professionals, connect with sponsors and recruiters, and compete for some cool prizes!",
  },
  {
    question: "Who can participate?",
    answer:
      "Hack Western applications are open to post-secondary students from across the world. Whether you are a freshman or completing your Ph.D., we want you to apply! Unfortunately, we will not be accepting high school students at this time.\nEach application is reviewed from the Hack Western organizing team, and decisions will be sent out on a rolling basis.",
  },
  {
    question: "Can I start working on my hack before the event?",
    answer:
      "We follow the Major League Hacking guidelines, which prohibits students from bringing and continuing a project that they have already worked on. Your final project should be new and only built during the weekend of Hack Western.",
  },
  {
    question: "How much does it cost to attend Hack Western?",
    answer:
      "Hack Western is completely free to attend, including free food and swag! Participants travelling to the event outside of Western and provided bus routes however may incur additional costs. ",
  },
  {
    question: "How many people can be on my team?",
    answer:
      "Your team cannot exceed more than four members. You can also work on a project by yourself, but we believe that hacking is more fun with friends. The more, the merrier!",
  },
  {
    question: "Will there be food and drinks??",
    answer:
      "All meals, snacks, and drinks will be provided throughout the hackathon to keep you fueled and hydrated.",
  },
  {
    question: "Are there travel reimbursements?",
    answer:
      "Yes, we provide partial reimbursements for travel costs after the event. To be eligible, you must submit a project during the hackathon. Reimbursements are contingent on available funds and are not guaranteed. To request reimbursement, email hello@hackwestern.com after the event with your travel receipts and project submission details.",
  },
] as const;

export const HACKATHON_FAQ: FaqType[] = [
  {
    question: "How many people can be on my team?",
    answer:
      "Teams can have up to 4 members. While you can participate solo, teamwork is encouraged for the best experience.",
  },
  {
    question: "Can I work on my hack before the event?",
    answer:
      "No, all work on your project must begin after the event officially starts. This ensures a fair competition for all participants.",
  },
  {
    question: "Can I submit multiple projects?",
    answer: "No, each team is allowed to submit only one project.",
  },
  {
    question: "Can my project use publicly available frameworks?",
    answer:
      "Yes, you can use publicly available frameworks, but be sure to credit them properly in your README file.",
  },
  {
    question: "Can I use tools like ChatGPT or other AI models?",
    answer:
      "Yes, but you must clearly credit any tools used and describe in your README what was built vs. what was generated. Projects that are simple reskins of existing AI tools may be disqualified.",
  },
  {
    question: "Do I have to submit code? If so, in what format?",
    answer:
      "Yes, submissions must include your code in an accessible format, such as a GitHub repository link, Google Drive link, or equivalent.",
  },
  {
    question: "When can I start hacking?",
    answer: "Hacking begins on Friday, November 23th at 9pm.",
  },
  {
    question: "What workshops and activities will there be?",
    answer:
      "We’ll host workshops from sponsors and clubs, networking sessions, and fun activities throughout the event. Keep an eye on the schedule for updates.",
  },
  {
    question: "What is the submission deadline?",
    answer: "Hacking ends on Sunday, December 1st at 9am.",
  },
  {
    question: "Will judging be in person?",
    answer:
      "Yes, judging will be conducted in person, science-fair style. Teams will present their projects to judges at their booths.",
  },
  {
    question: "What prizes are available?",
    answer: "You can find all the prizes available on our Dorahacks page.",
  },
  {
    question: "Can I submit to multiple bounties?",
    answer:
      "Yes, teams can submit their projects to multiple bounties if applicable.",
  },
  {
    question: "What are mentors?",
    answer:
      "Mentors are experienced individuals available throughout the event to provide guidance and answer your questions.",
  },
  {
    question: "How can I find mentors during the event?",
    answer:
      "Mentors will be available on-site and online through our communication platform. Look for the mentor tags or join the mentor-help channel.",
  },
  {
    question: "What resources will be provided?",
    answer:
      "We’ll provide a list of APIs, frameworks, and documentation to help you get started, as well as access to online tools.",
  },
  {
    question: "Will there be sleeping accommodations?",
    answer:
      "Yes! We provide mattresses on a first-come, first-served basis. You are welcome to bring your own sleeping bag, blanket, or pillow for added comfort. Designated quiet areas will also be available for rest throughout the event.",
  },
  {
    question: "Are there shower facilities?",
    answer:
      "Unfortunately, there will not be shower facilities at the venue, so plan accordingly. We recommend bringing toiletries and a change of clothes if you plan to stay overnight.",
  },
  {
    question: "What about food and drinks?",
    answer:
      "All meals, snacks, and drinks will be provided throughout the hackathon to keep you fueled and hydrated.",
  },
  {
    question: "Can I leave the venue and come back?",
    answer:
      "Yes, participants are free to leave and return during the hackathon, but ensure you have your event badge for re-entry.",
  },
  {
    question: "Will there be parking available?",
    answer:
      "Yes, parking is available near the venue. Check your participant guide for details on parking locations and rates.",
  },
  {
    question: "Are there travel reimbursements?",
    answer:
      "Yes, we provide partial reimbursements for travel costs after the event. To be eligible, you must submit a project during the hackathon. Reimbursements are contingent on available funds and are not guaranteed. To request reimbursement, email hello@hackwestern.com after the event with your travel receipts and project submission details.",
  },
  {
    question: "How do I apply for travel reimbursement?",
    answer:
      "Send an email to hello@hackwestern.com after the hackathon with: <br> - A copy of your travel receipts (e.g., bus/train tickets or flight details) <br> - Your team/project submission details <br> Reimbursements are processed based on the availability of funds, and priority may be given to those traveling from farther locations.",
  },
  {
    question: "Question not here?",
    answer:
      "Reach out to us through our contact page or during the event for any unanswered questions.",
  },
];
