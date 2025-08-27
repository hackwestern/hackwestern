export interface FolderData {
  label: string;
  gradientId: string;
  align: string;
  cards: [string, string][];
}

export const folderData: FolderData[] = [
  {
    label: "CREATIVE ARTS",
    gradientId: "red",
    align: "self-end",
    cards: [
      ["Git-place.png", "https://devpost.com/software/git-place"],
      ["Ghostwriter.png", "https://devpost.com/software/ghostwriter-qf69jk"],
      ["Dream Scape.png", "https://devpost.com/software/dreamscape-vbkud5"],
    ],
  },
  {
    label: "AI-POWERED",
    gradientId: "blue",
    align: "self-start",
    cards: [
      ["CoHerent.png", "https://devpost.com/software/co-herent"],
      ["Talk To Duckie.png", "https://dorahacks.io/buidl/20337"],
      ["Bravo Dispatch.png", "https://dorahacks.io/buidl/20371"],
    ],
  },
  {
    label: "GAMES",
    gradientId: "green",
    align: "self-end",
    cards: [
      ["Ar-cade.png", "https://devpost.com/software/ar-cade"],
      ["PacRoyale.png", "https://dorahacks.io/buidl/20381"],
      ["Credit Crimes.png", "https://devpost.com/software/papers-please-clone"],
    ],
  },
  {
    label: "DELIGHTFUL DESIGN",
    gradientId: "purple",
    align: "self-start",
    cards: [
      ["Genee.png", "https://devpost.com/software/tempname-ilm584"],
      ["Harbor-Ed.png", "https://devpost.com/software/harbor-ed"],
      ["Blocks.png", "https://dorahacks.io/buidl/20342"],
    ],
  },
  {
    label: "HARDWARE HACKS",
    gradientId: "orange",
    align: "self-end",
    cards: [
      ["infu.png", "https://devpost.com/software/infu"],
      ["SuperStage.png", "https://devpost.com/software/superstage"],
      ["HoverTouch.png", "https://devpost.com/software/hovertouch"],
    ],
  },
];
