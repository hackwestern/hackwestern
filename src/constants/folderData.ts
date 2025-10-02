export interface FolderData {
  label: string;
  gradientId: string;
  align: string;
  cards: [string, string, string][];
}

export const folderData: FolderData[] = [
  {
    label: "CREATIVE ARTS",
    gradientId: "red",
    align: "self-end",
    cards: [
      ["git-place.png", "https://devpost.com/software/git-place", "Git-place"],
      [
        "ghostwriter.png",
        "https://devpost.com/software/ghostwriter-qf69jk",
        "Ghostwriter",
      ],
      [
        "dreamscape.png",
        "https://devpost.com/software/dreamscape-vbkud5",
        "DreamScape",
      ],
    ],
  },
  {
    label: "AI-POWERED",
    gradientId: "blue",
    align: "self-start",
    cards: [
      ["coherent.png", "https://devpost.com/software/co-herent", "Co:herent"],
      [
        "talk-to-duckie.png",
        "https://dorahacks.io/buidl/20337",
        "Talk To Duckie",
      ],
      [
        "bravo-dispatch.png",
        "https://dorahacks.io/buidl/20371",
        "Bravo Dispatch",
      ],
    ],
  },
  {
    label: "GAMES",
    gradientId: "green",
    align: "self-end",
    cards: [
      ["arcade.png", "https://devpost.com/software/ar-cade", "AR.cade"],
      ["pacroyale.png", "https://dorahacks.io/buidl/20381", "PacRoyale"],
      [
        "credit-crimes.png",
        "https://devpost.com/software/papers-please-clone",
        "Credit Crimes",
      ],
    ],
  },
  {
    label: "DELIGHTFUL DESIGN",
    gradientId: "purple",
    align: "self-start",
    cards: [
      ["genee.png", "https://devpost.com/software/tempname-ilm584", "Genee"],
      ["harbored.png", "https://devpost.com/software/harbor-ed", "Harbor.ed"],
      ["blocks.png", "https://dorahacks.io/buidl/20342", "Blocks"],
    ],
  },
  {
    label: "HARDWARE HACKS",
    gradientId: "orange",
    align: "self-end",
    cards: [
      ["infu.png", "https://devpost.com/software/infu", "infu"],
      [
        "superstage.png",
        "https://devpost.com/software/superstage",
        "SuperStage",
      ],
      [
        "hovertouch.png",
        "https://devpost.com/software/hovertouch",
        "HoverTouch",
      ],
    ],
  },
];
