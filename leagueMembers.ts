export type LeagueRole = "league_admin" | "owner" | "viewer";
export type LeagueMember = {
  id: string;
  leagueId: "ipl-2026";
  name: string;
  email: string;
  role: LeagueRole;
  status: "active" | "invited" | "disabled";
};

export const ipl2026Members: LeagueMember[] = [
  { id: "member-pandiyan", leagueId: "ipl-2026", name: "Pandiyan", email: "pandiyan.mayathevar@gmail.com", role: "league_admin", status: "active" },
  { id: "member-saravana", leagueId: "ipl-2026", name: "Saravana", email: "saransamy@gmail.com", role: "league_admin", status: "active" },
  { id: "member-sashi", leagueId: "ipl-2026", name: "Sashi", email: "sashi511@gmail.com", role: "owner", status: "active" },
  { id: "member-jeba", leagueId: "ipl-2026", name: "Jeba", email: "jebarajsam@gmail.com", role: "owner", status: "active" },
  { id: "member-johny", leagueId: "ipl-2026", name: "Johny", email: "johnyamarnath@gmail.com", role: "owner", status: "active" },
  { id: "member-tamil", leagueId: "ipl-2026", name: "Tamil", email: "tamilkrishna.info@gmail.com", role: "owner", status: "active" },
  { id: "member-murali", leagueId: "ipl-2026", name: "Murali", email: "muralikg24@gmail.com", role: "owner", status: "active" },
  { id: "member-mansur", leagueId: "ipl-2026", name: "Mansur", email: "osa.mansurahamad@gmail.com", role: "owner", status: "active" },
  { id: "member-bala", leagueId: "ipl-2026", name: "Bala", email: "baluinfo@gmail.com", role: "owner", status: "active" },
];

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const findMemberByEmail = (email: string) => ipl2026Members.find(member => normalizeEmail(member.email) === normalizeEmail(email));
export const canManageLeague = (member?: LeagueMember) => member?.status === "active" && member.role === "league_admin";
export const canSubmitTeam = (member?: LeagueMember) => member?.status === "active" && (member.role === "owner" || member.role === "league_admin");
