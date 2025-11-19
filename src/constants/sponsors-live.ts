export type Sponsor = {
  name: string;
  logo: string;
  link: string;
  description?: string;
};

export type SponsorTier = {
  tier: string;
  sponsors: Sponsor[];
};

export const SPONSOR_TIERS: SponsorTier[] = [
  {
    tier: "Title Sponsor",
    sponsors: [
      {
        name: "Scotiabank",
        logo: "/sponsors/scotiabank.png",
        link: "https://www.scotiabank.com/",
        description:
          "Scotiabank's vision is to be our clients' most trusted financial partner, to deliver sustainable, profitable growth and maximize total shareholder return. Guided by our purpose: \"for every future,\" we help our clients, their families and their communities achieve success through a broad range of advice, products and services, including personal and commercial banking, wealth management and private banking, corporate and investment banking, and capital markets. With assets of approximately $1.4 trillion (as at July 31, 2024), Scotiabank trades on the Toronto Stock Exchange (TSX: BNS) and New York Stock Exchange (NYSE: BNS). For more information, please visit www.scotiabank.com and follow us on X @Scotiabank.",
      },
    ],
  },
  {
    tier: "Diamond Sponsors",
    sponsors: [
      {
        name: "Sun Life",
        logo: "/sponsors/sunlife.png",
        link: "https://www.sunlife.ca/",
        description:
          "Sun Life is a leading international financial services organization providing asset management, wealth, insurance, and health solutions to individual and institutional Clients. We're a global company with a passion for people, helping our Clients achieve lifetime financial security and live healthier lives. Through our ongoing commitment to digital leadership, we are adopting and experimenting with innovative technology to help drive Client impact. We are honoured to support Hack Western, and to support the next generation of digital leaders. sunlife.com",
      },
    ],
  },
  {
    tier: "Gold Sponsors",
    sponsors: [
      {
        name: "Canada Life",
        logo: "/sponsors/canadalife.png",
        link: "https://www.canadalife.com/",
        description:
          "Canada Life is a leading insurance, wealth management and benefits provider focused on improving the financial, physical, and mental well-being of Canadians. For over 175 years, individuals, families and business owners across Canada have trusted us to provide sound guidance and deliver on the promises we've made. We proudly serve more than 14 million customer relationships from coast to coast. Canada Life is a subsidiary of Great-West Lifeco Inc. and a member of the Power Corporation of Canada group of companies. Visit canadalife.com to learn more.",
      },
      {
        name: "Sentra",
        // TODO: Add Sentra logo
        logo: "/sponsors/sentra.png",
        link: "https://www.sentra.ai/",
        description:
          "Sentra is an AI alignment officer who creates a unified company memory, remembering details everyone forgot and alerting you when your teams are misaligned. It lives in the company like any other teammate - integrating with all communication platforms and workspaces, even sitting in meetings as your team's own notetaker. Sentra helps companies kill scaling pains by making organizational data digestible and flagging misalignments across the company before they grow out of proportion.",
      },
    ],
  },
  {
    tier: "Bronze Sponsors",
    sponsors: [
      {
        name: "Procter & Gamble",
        logo: "/sponsors/pg.png",
        link: "https://www.pg.ca/",
        description:
          "Procter & Gamble (P&G) is not just a leader in consumer goods; it's a tech-driven community that thrives on innovation and data analytics to enhance everyday products. With a commitment to digital transformation, P&G actively seeks bright minds to tackle complex challenges using cutting-edge technology, from AI and machine learning to cloud computing and IoT. As a hackathon participant, you'll have the opportunity to work on real-world projects that directly impact global brands and consumer experiences. Join us in shaping the future of consumer products and discover how your IT skills can drive meaningful change in a dynamic, purpose-driven company!",
      },
      {
        name: "Accenture",
        logo: "/sponsors/accenture.png",
        link: "https://www.accenture.com/",
        description:
          "Accenture is a leading global professional services company that helps the world's leading organizations build their digital core, optimize their operations, accelerate revenue growth and enhance services—creating tangible value at speed and scale. We are a talent- and innovation-led company with 774,000 people serving clients in more than 120 countries. Technology is at the core of change today, and we are one of the world's leaders in helping drive that change, with strong ecosystem relationships. We combine our strength in technology and leadership in cloud, data and AI with unmatched industry experience, functional expertise and global delivery capability. Our broad range of services, solutions and assets across Strategy & Consulting, Technology, Operations, Industry X and Song, together with our culture of shared success and commitment to creating 360° value, enable us to help our clients reinvent and build trusted, lasting relationships.",
      },
      {
        name: "Manulife",
        logo: "/sponsors/manulife.png",
        link: "https://www.manulife.ca/",
        description:
          "Manulife is a leading international financial services group that helps people make their decisions easier and lives better. We operate primarily as John Hancock in the United States and Manulife elsewhere. We provide financial advice, insurance, as well as wealth and asset management solutions for individuals, groups and institutions.",
      },
      {
        name: "Communications Security Establishment Canada",
        // TODO: Add CSE logo
        logo: "/sponsors/cse.png",
        link: "https://www.cse-cst.gc.ca/",
        description:
          "Communications Security Establishment Canada (CSE) is the national cryptologic agency, providing the Government of Canada with information technology security and foreign signals intelligence. CSE student jobs are unlike most others. Our students work on meaningful projects that have an impact on the country, and they build personal connections that last beyond their student years. Our main objective is to retain our students as full-time employees after their studies.\n\nTo be part of CSE's student program you must be registered full-time in a Canadian college or university. Our students work on challenging, interesting and unique projects which help keep our country safe from cyber threats. Every employee plays a key role in protecting Canada and Canadians while working with some of the most advanced technologies in the world. Where else can you say that at the end of every workday?\n\nIf you are interested in a student position with CSE, please note that you must submit your application approximately eight months prior to the start of your desired placement. Students at CSE must go through a rigorous security clearance process that takes approximately six months to complete.",
      },
    ],
  },
  {
    tier: "In-Kind Sponsors",
    sponsors: [
      {
        name: "Warp",
        logo: "/sponsors/warp.png",
        link: "https://www.warp.dev/",
        description:
          "The intelligent terminal. Become a command line power user on day one. Warp combines AI and your dev team's knowledge in one fast, intuitive terminal.",
      },
      {
        name: "Morrissette Institute for Entrepreneurship",
        // TODO: Add Morrissette logo (if not exists)
        logo: "/sponsors/morrissette.png",
        link: "https://entrepreneurship.uwo.ca/",
        description:
          "Morrissette Institute for Entrepreneurship supports entrepreneurship and innovation at Western University and beyond. They have supported hundreds of entrepreneurs navigate the complexities of starting and growing a business by connecting them with the right resources to succeed. If you're a Western student, check out their programs and resources today! https://entrepreneurship.uwo.ca/for-students/",
      },
    ],
  },
];

export const SPONSOR_THANK_YOU_TEXT =
  "Thank you to our Sponsors! Hack Western 12 would not be possible without the generous donation of all our sponsors and partners.";
