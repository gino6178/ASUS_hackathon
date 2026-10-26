// The four coach agents. Each one retrieves its own slice of player memory before it answers.
export const COACHES = [
  {
    id: "fitness", name: "Coach Ren", role: "Strength & Conditioning", zh: "體能教練", color: "#FF8A6B",
    look: { skin: "#E8B48F", hair: "#2B1D16", hairStyle: "buzz", shirt: "#FF8A6B", prop: "band" },
    blurb: "Lights up the muscles your match exposed and builds the gym work around them.",
    query: "body injury knee shoulder back fatigue strength gym routine training load jump 膝 傷 體能",
  },
  {
    id: "tactics", name: "Coach Lin", role: "Badminton Tactics", zh: "羽球教練", color: "#F2E6C9",
    look: { skin: "#F0C7A5", hair: "#1B1B1F", hairStyle: "bob", shirt: "#2F8F6F", prop: "whistle" },
    blurb: "Reads your match, opens the heat maps and flashes the zones that cost you points.",
    query: "goal tactics defence rear court opponent rally win point 目標 防守 戰術",
  },
  {
    id: "technique", name: "Coach Kai", role: "Stroke Technique", zh: "技術教練", color: "#6FB6FF",
    look: { skin: "#C98F6A", hair: "#3A2A20", hairStyle: "swept", shirt: "#6FB6FF", prop: "racket" },
    blurb: "Replays every flight and grades the quality of each shot you hit.",
    query: "technique smash clear net shot drop racket grip stroke 殺球 技術",
  },
  {
    id: "analyst", name: "Coach Ada", role: "Match Data Analyst", zh: "數據分析教練", color: "#5FD39A",
    look: { skin: "#F3D2B8", hair: "#5A3B2A", hairStyle: "pony", shirt: "#111A20", prop: "glasses" },
    blurb: "Profiles a player's habits, heat zones and attacking patterns from every shot.",
    query: "opponent scouting habit pattern data serve 習慣 對手",
  },
];
export const coachById = (id) => COACHES.find((c) => c.id === id);
