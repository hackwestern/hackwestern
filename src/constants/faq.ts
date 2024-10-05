export type FaqType = {
  question: string;
  answer: string;
};

export const GENERALHACK_FAQ: FaqType[] = [
  {
    question: "When can I start hacking?",
    answer:
      "Hacking begins at 10pm on Friday, November 29th, 2024 and ends at 10am on Sunday, December 1st, 2024. All code written for Hack Western must be written within this timeframe, with the exception of code taken from public and open source libraries, APIs, or tutorials. Any projects found to be worked on outside of this time frame will be disqualified from judging.",
  },
  {
    question: "Can I work on a hack I’ve started before?",
    answer:
      "We follow the Major League Hacking guidelines, which prohibits students from bringing and continuing a project that they have already worked on. Your final project should be new and only built during the weekend of Hack Western.",
  },
  {
    question: "How many people do I need in a team?",
    answer:
      "Hackers can be in teams of up to 4 people, which means you could also solo hack if you wish. You do not need to tell us who your team members are, simply add them to your Devpost submission before the deadline.",
  },
  // TODO: update for this year
  // {
  //   question: "Where can I go if I need help?",
  //   answer:
  //     "We will have a help desk available at the lower ground floor (level 2) all weekend to answer any questions/provide assistance. Otherwise, you can reach an organizer by tagging @organizers in Slack in the <a class='underline font-bold' target='_blank' rel='noopener' href='https://hackwestern10.slack.com/archives/C065X1MLQTT'>#questions</a> channel. Organizers will also be identifiable throughout the venue by having black nametags. For project help, please refer to the following section.",
  // },
  {
    question: "What are mentors?",
    answer:
      "Whether you’re stuck trying to debug a project, can’t come up with an idea, or just need some overall guidance on how to proceed, mentors are here to help you succeed! We will have various mentors available on-call to help hackers with their projects throughout the weekend. Note that mentors are only available for support, and are not writing code for you. In this site, you can navigate to the <a class='underline font-semibold' href='https://hackwestern.com/live/mentors'>Mentors tab</a> to see all of our mentors for this weekend for reference.",
  },
  // TODO: update for this year
  // {
  //   question: "How do I get help from a mentor?",
  //   answer:
  //     "To reach a mentor, join the <a class='underline font-semibold' target='_blank' rel='noopener' href='https://hackwestern10.slack.com/archives/C065J9EU22F'>#mentorship</a> channel in Slack where you can submit a request for a mentor by indicating what sort of help you need and where you are in the building. You may also go to the Mentors Hub at any time to find a mentor.",
  // },
];

// TODO: Update these answers
//
// export const SUBMISSION_FAQ: FaqType[] = [
//   {
//     question: "How do I submit my project?",
//     answer:
//       "All hackers must submit their project on Devpost in order to qualify for prizes. To do so, you must register on <a class='underline font-semibold' target='_blank' rel='noopener' href='https://hack-western-10.devpost.com/'>https://hack-western-10.devpost.com/</a> and submit your project before 9am on Sunday, November 26th. Note that this is 1 hour before the official hacking period ends, you will only need to submit by this deadline but may continue editing the Devpost and hacking until the 10am finish.",
//   },
//   {
//     question: "What prizes are available?",
//     answer:
//       "Check out our devpost at <a class='underline font-semibold' target='_blank' rel='noopener' href='https://hack-western-10.devpost.com/'>https://hack-western-10.devpost.com/</a> for a full list of all the prizes up for grabs at Hack Western 10! We are extremely grateful for the variety of prizes donated by our sponsors to Hack Western this year. To learn more about specific sponsor prizes, visit the sponsor booth in-person or join the relevant channels on Slack!",
//   },
//   {
//     question: "How will judging work?",
//     answer:
//       "When you submit your project on <a class='underline font-semibold' target='_blank' rel='noopener' href='https://hack-western-10.devpost.com/'>Devpost</a>, you will have the option to select which sponsor prizes you want to opt-in for. Your projects will be judged for those categories you select. Some prizes are already eligible to all projects and do not need to be opted-in to, which include the overall winners of Hack Western as well as the Organizers’ Choice Awards. On Sunday, November 26th, there will be a Demo Fair from 10:30am-1pm where all projects will be judged expo-style. You will be given a time lock within this duration and a table number in which your team can prepare to pitch your projects to judges as they walk around. Each pitch may not be longer than 3 minutes. Finalists for overall prizes will pitch again during Closing Ceremonies.",
//   },
// ];

export const OTHER_FAQ: FaqType[] = [
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
    question: "How much does it cost to attend Hack Western?",
    answer:
      "Hack Western is completely free to attend, including free food and swag! Participants travelling to the event outside of Western and provided bus routes however may incur additional costs. ",
  },
  {
    question: "What if it's my first hackathon?",
    answer:
      "There's always a first time for everything, right?  The first time is always intimidating, but with support from company mentors, beginner-friendly workshops, and a large network of passionate students, we're confident that you'll find your stride and have a great weekend.\nHack Western is a hackathon where individuals from various disciplines, majors, and backgrounds are encouraged to come out and participate.",
  },
  {
    question: "Can I start working on my hack before the event?",
    answer:
      "We follow the Major League Hacking guidelines, which prohibits students from bringing and continuing a project that they have already worked on. Your final project should be new and only built during the weekend of Hack Western.",
  },
  {
    question: "Hacking? What is that?",
    answer:
      "If you're attending a hackathon, you'll probably be spending majority of your weekend hacking - that is, ideating, prototyping, and building an innovative solution to the issue that you're trying to solve. Contrary to popular belief, hacking isn't just about coding. As a hacker, you'll also be brainstorming, designing, testing, and pitching your project (among many other things)!",
  },
  {
    question: "When do hacker applications open?",
    answer:
      "We will be announcing hacker applications in early October. Follow our social media and sign up for our mailing list by pre-registering here to be the first to find out.",
  },
  {
    question: "What workshops and activities will there be?",
    answer:
      "You won't be hacking for 36 hours straight, as there will be many workshops and activities you can participate in during the event as well as the week leading up to it. Last year, our workshops included topics like creating chrome extensions, building voice apps, pitching your hackathon project, recruiting, and more. Our full schedule will be released closer to the event!",
  },
  {
    question: "How many people can be on my team?",
    answer:
      "Your team cannot exceed more than four members. You can also work on a project by yourself, but we believe that hacking is more fun with friends. The more, the merrier!",
  },
  {
    question: "Question not here?",
    answer:
      "Feel free to reach out to us on social media or directly at <a class='text-bold underline' href='mailto:hello@hackwestern.com'>hello@hackwestern.com</a> and we will be more than happy to answer any of your questions.",
  },
];
