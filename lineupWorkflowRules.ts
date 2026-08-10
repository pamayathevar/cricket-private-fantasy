export type PriorFixtureForSubmission = {
  id: string;
  match_number: number;
  status: string;
  lineup_lock_at?: string | null;
  scheduled_start?: string | null;
};

export type TransferPeriodForSubmission = {
  start_match_number: number;
  end_match_number: number;
  first_match_free: boolean;
};

export const isLineupLocked = (lineupLockAt?: string | null, now = Date.now()) => {
  if (!lineupLockAt) return false;
  const lockTime = new Date(lineupLockAt).getTime();
  return Number.isFinite(lockTime) && now >= lockTime;
};

export const firstMissingOpenPriorMatch = (
  fixtures: PriorFixtureForSubmission[],
  submittedFixtureIds: ReadonlySet<string>,
  now = Date.now(),
) => fixtures.find(fixture => {
  if (fixture.status !== "scheduled" || submittedFixtureIds.has(fixture.id)) return false;
  const lockTime = new Date(fixture.lineup_lock_at ?? fixture.scheduled_start ?? "").getTime();
  return Number.isFinite(lockTime) && lockTime > now;
})?.match_number ?? null;

export const hasSubmittedInTransferPeriod = (
  fixtures: PriorFixtureForSubmission[],
  submittedFixtureIds: ReadonlySet<string>,
  period?: TransferPeriodForSubmission,
) => !!period && fixtures.some(fixture =>
  fixture.match_number >= period.start_match_number
  && fixture.match_number <= period.end_match_number
  && submittedFixtureIds.has(fixture.id),
);

export const isFreeTransferSubmission = ({
  period,
  hasPriorPeriodLineup,
  firstMissingPriorMatch,
  loading,
}: {
  period?: TransferPeriodForSubmission;
  hasPriorPeriodLineup: boolean;
  firstMissingPriorMatch: number | null;
  loading: boolean;
}) => !!period?.first_match_free && !hasPriorPeriodLineup && !firstMissingPriorMatch && !loading;

export const countLineupChanges = (
  currentPlayers: readonly string[],
  previousPlayers: ReadonlySet<string>,
  isChargeable: (player: string) => boolean = () => true,
) => currentPlayers.filter(player => isChargeable(player) && !previousPlayers.has(player)).length;

export const isSuperTransferAvailable = ({
  period,
  hasPriorPeriodLineup,
  firstMissingPriorMatch,
  alreadyUsed,
}: {
  period?: TransferPeriodForSubmission;
  hasPriorPeriodLineup: boolean;
  firstMissingPriorMatch: number | null;
  alreadyUsed: boolean;
}) => {
  const initialLineupIsFree = !!period?.first_match_free && !hasPriorPeriodLineup;
  return !initialLineupIsFree && !firstMissingPriorMatch && !alreadyUsed;
};

export const canViewSubmittedLineup = ({
  viewerMemberId,
  ownerMemberId,
  lineupLockAt,
  revealAfterLock,
  now = Date.now(),
}: {
  viewerMemberId: string;
  ownerMemberId: string;
  lineupLockAt?: string | null;
  revealAfterLock: boolean;
  now?: number;
}) => viewerMemberId === ownerMemberId
  || (revealAfterLock && isLineupLocked(lineupLockAt, now));

export const lineupSubmitActionLabel = ({
  hasSavedLineup,
  unchanged,
}: {
  hasSavedLineup: boolean;
  unchanged: boolean;
}) => !hasSavedLineup ? "Submit XI" : unchanged ? "Submitted ✓" : "Resubmit XI";

export type FixtureOwnerAction = "submit" | "edit" | "history" | "later";

export const fixtureOwnerAction = ({
  availableForSelection,
  locked,
  completed,
  published,
  hasSubmission,
}: {
  availableForSelection: boolean;
  locked: boolean;
  completed: boolean;
  published: boolean;
  hasSubmission: boolean;
}): FixtureOwnerAction => {
  if (!locked && availableForSelection) return hasSubmission ? "edit" : "submit";
  if (locked || completed || published) return "history";
  return "later";
};

export const fixtureOwnerActionLabel = ({
  action,
  published,
}: {
  action: FixtureOwnerAction;
  published: boolean;
}) => action === "submit"
  ? "Submit XI"
  : action === "edit"
    ? "Edit XI"
    : action === "history"
      ? published ? "View scores" : "View XI"
      : "OPENS LATER";

export const selectSingleMatchBooster = (current: string, requested: string) =>
  current === requested ? "" : requested;

export const boosterForFixture = <T extends string>({
  isCurrentSubmission,
  savedCode,
  savedPlayer,
}: {
  isCurrentSubmission: boolean;
  savedCode?: T | null;
  savedPlayer?: string | null;
}) => isCurrentSubmission
  ? { code: savedCode ?? "", player: savedPlayer ?? "" }
  : { code: "", player: "" };

export const isPowerRoleRestricted = ({
  labels,
  playerOwner,
  currentOwner,
}: {
  labels: readonly string[];
  playerOwner?: string | null;
  currentOwner: string;
}) => (labels.includes("UNIQUE") || labels.includes("AUTO UNIQUE"))
  && playerOwner !== currentOwner;
