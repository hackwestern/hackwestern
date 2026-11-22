// User-facing copy for the judging tour at /judging-tour: one page that walks
// judges and hackers through general judging, stop by stop, with the judge's
// phone and the hacker's screen side by side on mock data. The screens are
// the real judging components; only the words around them live here.
// Times and places come from the HW13 run of show.

export const judgingTourCopy = {
  title: "Judging tour",
  eyebrow: "Hack Western 13 · general judging",
  heading: "How judging works",
  intro:
    "Hackers stay at their table and demo. Judges walk the room and score them. Here is what both screens show at each step, using sample teams.",
  facts: [
    { label: "When", value: "11:45 AM to 1:00 PM, Sunday" },
    { label: "Where", value: "Grand Hall, SEI 1110" },
    { label: "Each round", value: "3 min demo, 2 min Q&A, 1:30 to move" },
    { label: "Each team", value: "Scored by 3 judges" },
  ],
  views: {
    label: "Show",
    both: "Both",
    judge: "Judges",
    hacker: "Hackers",
  },
  judgeScreen: "Judge's phone",
  hackerScreen: "Hacker's screen",
  stopOf: (n: number, total: number) => `Stop ${n} of ${total}`,
  back: "Back",
  next: "Next",
  restart: "Start over",
  sample: "Sample data. Your table and teams will be different.",
  keys: "Arrow keys move between stops.",

  qr: {
    judge: {
      label: "Judges",
      route: "hackwestern.com/judge",
      alt: "QR code for hackwestern.com/judge",
    },
    hacker: {
      label: "Hackers",
      route: "hackwestern.com/rounds",
      alt: "QR code for hackwestern.com/rounds",
    },
  },

  stops: {
    open: {
      nav: "Make an account",
      title: "Make an account, then open your page",
      judge: [
        "Make an account at hackwestern.com/register with the email you gave us, and verify it from your inbox. We add you as a judge once your email is verified.",
        "Then scan the judges' code, or go to hackwestern.com/judge. Not signed in? You'll see the login page first, then you land straight back on the judge app.",
        'If it says "You\'re not set up as a judge yet", find Jasmine at the front.',
      ],
      hacker: [
        "Scan the hackers' code, or go to hackwestern.com/rounds.",
        "Not signed in? Log in to your hacker portal and you come back to Judging Rounds. It's also in the portal's menu.",
      ],
    },
    room: {
      nav: "The room",
      title: "70 tables, laid out in a snake",
      lead: "Tables are numbered along a snake: row 1 left to right, row 2 right to left, and so on. Every team gets one table, and every judge gets a short stretch of tables in a row.",
      judge: [
        "You walk. Your phone shows your next table and the way there, and the Map tab shows the whole room with your tables marked.",
        "Each team is scored by 3 different judges, so you'll only see part of the room.",
      ],
      hacker: [
        "Your page shows your table number. Set up there and stay there.",
        "You can't move tables. If a judge comes and nobody is at your table, your team is marked absent and disqualified from judging.",
      ],
    },
    before: {
      nav: "Before round 1",
      title: "Get ready before the first round",
      judge: [
        "Your phone lists the teams in your queue. Conflict of interest? If you know anyone on one of them, send that team's table number to Luca on Slack before you start, and we'll swap them.",
        'Press Start judging. You\'ll wait on "Waiting for round 1" until we start the clock.',
      ],
      hacker: [
        "Have your demo running and ready to show.",
        "Your page says judging hasn't started yet. Stay at your table.",
      ],
      screens: { welcome: "Welcome", waiting: "Waiting" },
    },
    walk: {
      nav: "Round starts",
      title: "Round starts: judges walk to their table",
      judge: [
        "When the round starts, your phone shows your table, the team, and which way to walk.",
        "The timer on your phone and on the big screen counts the round down.",
      ],
      hacker: [
        "Not every team has a judge every round, so some rounds you'll wait idle. Your page tells you whether a judge is coming this round.",
        "A judge is due but nobody came after a minute? Press Judge missing. We'll send you one in the catch-up round, so you won't lose a score.",
      ],
      screens: { coming: "Judge coming", idle: "No judge this round" },
    },
    demo: {
      nav: "Demo and Q&A",
      title: "No presentations. Just demos.",
      lead: "No slides and no pitch deck. Each visit is a 3 minute demo of the project working, then 2 minutes of questions.",
      judge: [
        "Press Judge this team when you arrive.",
        "Give them 3 minutes to show it working, then use 2 minutes for questions. Stuck for questions? The Questions tab has a few per criterion.",
        "Score all 5 criteria, add a note if you like, then press Next team. Your score saves on the phone as you go.",
      ],
      hacker: [
        "You get 3 minutes to show what you built, live. Start with what it does, then how you built it.",
        "Then 2 minutes of questions from the judge. They score while you talk.",
      ],
    },
    buffer: {
      nav: "Transition",
      title: "About 1:30 to move between tables",
      judge: [
        "With 1:30 left the timer says Buffer. Send your score and walk to your next table. Your phone names it.",
        "Ran out of time? You can still score that team late from My teams.",
      ],
      hacker: [
        "The big screen says judges are switching tables. Your page shows you've been judged this round.",
        "Stay at your table. Your next judge comes in a later round.",
      ],
    },
    timeup: {
      nav: "Time's up",
      title: "When the round's time runs out",
      judge: [
        "At 0:00 the round closes and your phone says the round is over. Wait where you are until we start the next one.",
        "A score you didn't send stays on your phone under Not sent yet. Send it from My teams.",
      ],
      hacker: [
        "Your page says the round is over. Stay at your table for the next round.",
      ],
    },
    criteria: {
      nav: "What we score",
      title: "How projects are scored",
      lead: "Every criterion is a slider from 1 to 10 in half steps. 5 is an average project. 9 is a project you see as winning. The overall score is the plain average of the five.",
      judge: [
        "Tap Show descriptions on the Score screen to see these while you score.",
        "Super like a team that stood out. Super likes are taken into account when we pick winners.",
        "Don't worry about checking how complete a project is. The web team marks completeness and gives an extra mark for each team's GitHub and LinkedIn.",
      ],
      hacker: [
        "These are the same 5 criteria your judges see. Cover each one in your demo.",
        "The web team separately checks your project for completeness, and gives an extra mark for your GitHub and LinkedIn. Keep them up to date.",
      ],
      adventurous: {
        title: "Most Adventurous track",
        body: "The Adventurous criterion feeds the Most Adventurous track. A team's adventure score is 65% their Adventurous rating and 35% the other four criteria.",
      },
    },
    problems: {
      nav: "If something's off",
      title: "If a team or a judge isn't there",
      judge: [
        "Nobody at your table? Use Team not here on the Score screen. It disqualifies the team for every judge, so look around first.",
        "Then wait for the next round. Your phone tells you where to go next.",
      ],
      hacker: [
        "Press Judge missing if nobody has come a minute into your round. The organizers see it right away.",
        "Marked absent by mistake? Find an organizer now. Only they can undo it.",
      ],
    },
    catchup: {
      nav: "Catch-up round",
      title: "Done with your tables? Stay a little longer",
      judge: [
        "After your last table, stay in the hall. We run a catch-up round for any team that missed a judge.",
        "If you get a catch-up table, your phone moves you there. If not, it says No table this round. Stay close in case we need you.",
      ],
      hacker: [
        "Keep your demo set up until your page says Your team has been judged.",
        "A team that reported a missing judge gets one now.",
      ],
    },
    finish: {
      nav: "Re-score and submit",
      title: "Re-score, then submit",
      judge: [
        "Go back through every team once and adjust any score, now that you've seen them all.",
        "Then submit. Scores lock after that, and you'll see how yours compare with other judges.",
      ],
      hacker: [
        "Nothing to do. Your team has been judged.",
        "Finalists are announced at the closing ceremony at 2:00 PM.",
      ],
    },
    roam: {
      nav: "Walk around + MLH",
      title: "Free walk-around, and MLH tracks",
      judge: [
        "Once you've submitted, you're free to walk the room and see any demo you like. These visits don't count toward scores.",
        "Judging ends at 1:00 PM.",
      ],
      hacker: [
        "Keep your demo running until 1:00 PM. Judges who are done walk around to see projects.",
        "Entered an MLH track? Someone from MLH comes by your table to judge you for it. That's separate from the general score, so demo it again.",
      ],
      mlh: {
        title: "About MLH",
        body: "Major League Hacking (MLH) is the student hackathon league that Hack Western is part of. During judging, someone from MLH walks the room and visits the teams entered in MLH tracks. They judge those tracks themselves, and MLH prizes are announced at closing.",
      },
    },
    routes: {
      nav: "All the links",
      title: "Every link in one place",
      rows: [
        {
          who: "Judges",
          route: "hackwestern.com/register",
          what: "Make your account with the email you gave us, then verify it.",
        },
        {
          who: "Judges",
          route: "hackwestern.com/judge",
          what: "The judge app: your table, the timer, scoring. Sends you to log in first if you aren't.",
        },
        {
          who: "Hackers",
          route: "hackwestern.com/rounds",
          what: "Your table number and where judging is at, plus Judge missing. Sends you to log in first if you aren't.",
        },
        {
          who: "Hackers",
          route: "hackwestern.com/live",
          what: "Your hacker portal. Judging Rounds is in its menu.",
        },
        {
          who: "Everyone",
          route: "hackwestern.com/judging-tour",
          what: "This tour.",
        },
        {
          who: "Everyone",
          route: "Big screen",
          what: "The round timer at the front of the hall.",
        },
        {
          who: "Hackers",
          route: "Help desk",
          what: "Problems with your submission or table? Go to the hacker judging help desk.",
        },
      ],
    },
  },
  /** /judging-tour/hackers: one screen for the projector, for hackers. */
  hackerBriefing: {
    title: "Judging for hackers",
    eyebrow: "Hack Western 13 · judging · 11:45 AM to 1:00 PM",
    heading: "Stay at your table. Judges come to you.",
    timing: {
      label: "Every round",
      parts: [
        { time: "3 min", what: "Demo" },
        { time: "2 min", what: "Q&A" },
        { time: "1:30", what: "Judges move" },
      ],
      note: "No slideshows. Show your project working.",
    },
    rules: [
      {
        title: "Don't move",
        body: "Stay at your table for every round. If a judge comes and nobody is there, your team is disqualified.",
      },
      {
        title: "Watch the big clock",
        body: "One central clock times every round for the whole room. Everyone demos at the same time.",
      },
      {
        title: "About 7 rounds",
        body: "Some rounds a judge comes to you, some rounds you wait. Three different judges score your team.",
      },
      {
        title: "Then look around",
        body: "Once the rounds are over, walk around, talk, and see other projects until 1:00 PM.",
      },
    ],
    link: {
      label: "Your judging page",
      route: "hackwestern.com/rounds",
      alt: "QR code for hackwestern.com/rounds",
      body: "Log in and keep it open. Each round it tells you one of two things:",
      states: { coming: "A judge is coming", idle: "Idle this round" },
    },
    criteria: {
      label: "What judges mark you on",
      note: "Each one from 1 to 10. 5 is an average project.",
    },
    tourLink: "See the full walkthrough at hackwestern.com/judging-tour",
  },

  /** /judging-tour/judges: the judges' briefing, for the projector. */
  judgeBriefing: {
    title: "Judging for judges",
    eyebrow: "Hack Western 13 · judge briefing",
    teams: {
      step: "First",
      heading: "These are your teams",
      body: "Open hackwestern.com/judge. Before you start, your phone lists the teams in your queue with everyone on them.",
      phone: "Judge's phone",
      url: "hackwestern.com/judge",
    },
    conflict: {
      heading: "Any conflict of interest?",
      body: "If you know anyone on one of your teams (a friend, classmate, coworker or family), you shouldn't judge them.",
      action: "Send the team's table number to Luca on Slack.",
      after: "We'll swap that team out before judging starts.",
    },
    run: {
      step: "Then",
      heading: "How judging runs",
      parts: [
        { time: "3 min", what: "Demo" },
        { time: "2 min", what: "Q&A" },
        { time: "1:30", what: "Walk to next table" },
      ],
      note: "No presentations or slides. Teams show the project working.",
      steps: [
        {
          title: "Walk to your table",
          body: "When a round starts, your phone shows your table and which way to walk. Hackers stay put. The big clock times every round.",
        },
        {
          title: "Judge, then score",
          body: "Press Judge this team, watch the 3 minute demo, ask questions for 2 minutes, score all 5 criteria, then press Next team.",
        },
        {
          title: "Nobody there?",
          body: "Look around first, then press Team not here. It disqualifies the team for every judge.",
        },
        {
          title: "After your last table",
          body: "Stay for the catch-up round, re-score your teams once, then submit. After that, walk around until 1:00 PM.",
        },
      ],
    },
    criteria: {
      label: "What you're marking",
      note: "1 to 10 in half steps. 5 is an average project. 9 is a project you see as winning.",
      superLike:
        "Super like a team that stood out. We take super likes into account when picking winners.",
      completeness:
        "Don't assess completeness. The web team marks it, and gives an extra mark for each team's GitHub and LinkedIn.",
      mlh: "MLH tracks are judged by someone from MLH, separately from you.",
    },
    tourLink: "See the full walkthrough at hackwestern.com/judging-tour",
  },
} as const;

export type JudgingTourCopy = typeof judgingTourCopy;
