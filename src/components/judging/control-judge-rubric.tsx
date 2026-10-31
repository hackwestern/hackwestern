import { Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { card, focusRing, primaryButton } from "~/components/judging/judge-ui";
import {
  DEFAULT_RUBRIC,
  MAX_POINT,
  type Ratings,
  type Rubric,
  type RubricCriterion,
  RubricScorer,
  effectiveWeight,
  hasGuide,
  isValidScale,
  scoreRubric,
} from "~/components/judging/rubric-scorer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  BTN_DARK,
  BTN_OUTLINE,
  CARD,
  FIELD,
  MUTED,
  type Status,
  StatusLine,
} from "./control-shared";
import { SearchAutocomplete } from "../internals/search-autocomplete";

const MAX_DESCRIPTION = 140;

/** A rubric that has been saved. `id` is what Save writes back to. */
export type SavedRubric = { id: string; owner: string; rubric: Rubric };

const uid = () => Math.random().toString(36).slice(2, 9);

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const blankCriterion = (): RubricCriterion => ({
  id: uid(),
  name: "",
  description: "",
  min: 1,
  max: 5,
  weight: 1,
  low: "",
  mid: "",
  high: "",
});

const blankRubric = (): Rubric => ({
  title: "",
  weighted: false,
  criteria: [blankCriterion()],
});

const cloneRubric = (r: Rubric): Rubric => ({
  ...r,
  criteria: r.criteria.map((c) => ({ ...c })),
});

const crit = (
  name: string,
  description: string,
  weight = 1,
): RubricCriterion => ({ ...blankCriterion(), name, description, weight });

/** Mock data until the backend exists. Replace with a query. */
export const STARTER_RUBRICS: SavedRubric[] = [
  { id: "general", owner: "Organizers", rubric: DEFAULT_RUBRIC },
  {
    id: "weighted-example",
    owner: "Organizers",
    rubric: {
      title: "Weighted example",
      weighted: true,
      criteria: [
        crit("Technical difficulty", "How hard was this to build?", 2),
        crit("Impact", "Would it help real people?", 2),
        crit("Design", "Is it polished and easy to use?"),
        crit("Presentation", "Was the pitch clear, with a live demo?"),
      ],
    },
  },
];

function criterionErrors(c: RubricCriterion, weighted: boolean): string[] {
  const errors: string[] = [];
  if (!c.name.trim()) errors.push("Give this criterion a name.");
  if (!isValidScale(c))
    errors.push(
      `Points must be whole numbers from 0 to ${MAX_POINT}, with max above min.`,
    );
  if (weighted && !(c.weight > 0)) errors.push("Weight must be above 0.");
  return errors;
}

const num = (e: React.ChangeEvent<HTMLInputElement>) =>
  Number.isNaN(e.target.valueAsNumber) ? 0 : e.target.valueAsNumber;

const CHIP =
  "whitespace-nowrap rounded-full border border-gray-3 px-2.5 py-0.5 text-xs font-semibold";

type Draft = { criterion: RubricCriterion; isNew: boolean } | null;
type Undo = { criterion: RubricCriterion; index: number } | null;

type Props = {
  initial?: Rubric;
  /** Rubrics that can be opened from the autocomplete. */
  rubrics?: SavedRubric[];
  /** `id` is the saved rubric's id, new or existing. */
  onSave?: (rubric: Rubric, id: string) => void;
};

export function RubricBuilder({
  initial,
  rubrics = STARTER_RUBRICS,
  onSave,
}: Props) {
  const [rubric, setRubric] = useState<Rubric>(initial ?? blankRubric());
  const [saved, setSaved] = useState<SavedRubric[]>(rubrics);
  // Which saved rubric is open. null = a new rubric that hasn't been saved.
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  // Preview only: what the "judge" has tapped. Never saved.
  const [ratings, setRatings] = useState<Ratings>({});
  const [guideOpen, setGuideOpen] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [undo, setUndo] = useState<Undo>(null);
  // The autocomplete's text. Owned here so the builder can clear it.
  const [search, setSearch] = useState("");

  // The criterion being edited in the dialog. A draft, so Cancel discards it.
  const [draft, setDraft] = useState<Draft>(null);
  const [draftTried, setDraftTried] = useState(false);

  const { criteria, weighted } = rubric;

  // ---- Smooth reordering (FLIP) ---------------------------------------------
  // Before a change that moves rows, remember where each one is. After React
  // re-renders, slide every row from its old spot to its new one.
  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  const prevTops = useRef<Map<string, number> | null>(null);

  const snapshotPositions = () => {
    prevTops.current = new Map(
      Array.from(itemRefs.current.entries()).map(([id, el]) => [
        id,
        el.getBoundingClientRect().top,
      ]),
    );
  };

  useIsomorphicLayoutEffect(() => {
    const before = prevTops.current;
    if (!before) return;
    prevTops.current = null;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    itemRefs.current.forEach((el, id) => {
      const old = before.get(id);
      if (old === undefined) return;
      const dy = old - el.getBoundingClientRect().top;
      if (Math.abs(dy) < 1) return;
      el.animate(
        [{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }],
        { duration: 220, easing: "cubic-bezier(0.2, 0, 0, 1)" },
      );
    });
  }, [criteria]);

  const change = (next: Partial<Rubric>) => {
    setRubric((r) => ({ ...r, ...next }));
    setStatus(null);
    setUndo(null);
    setDirty(true);
  };
  const removeCriterion = (id: string) => {
    const index = criteria.findIndex((c) => c.id === id);
    const removed = criteria[index];
    if (!removed) return;
    snapshotPositions();
    change({ criteria: criteria.filter((c) => c.id !== id) });
    setUndo({ criterion: removed, index });
  };
  const undoRemove = () => {
    if (!undo) return;
    snapshotPositions();
    const next = [...criteria];
    next.splice(Math.min(undo.index, next.length), 0, undo.criterion);
    change({ criteria: next });
  };
  const duplicateCriterion = (id: string) => {
    const i = criteria.findIndex((c) => c.id === id);
    const original = criteria[i];
    if (!original) return;
    snapshotPositions();
    const copy = { ...original, id: uid(), name: `${original.name} (copy)` };
    change({
      criteria: [...criteria.slice(0, i + 1), copy, ...criteria.slice(i + 1)],
    });
  };
  const moveCriterion = (id: string, dir: -1 | 1) => {
    const i = criteria.findIndex((c) => c.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= criteria.length) return;
    snapshotPositions();
    const next = [...criteria];
    [next[i], next[j]] = [next[j]!, next[i]!];
    change({ criteria: next });
  };

  // ---- Dialog --------------------------------------------------------------
  const openNew = () => {
    setDraft({ criterion: blankCriterion(), isNew: true });
    setDraftTried(false);
  };
  const openEdit = (c: RubricCriterion) => {
    setDraft({ criterion: { ...c }, isNew: false });
    setDraftTried(false);
  };
  const patchDraft = (patch: Partial<RubricCriterion>) =>
    setDraft((d) => d && { ...d, criterion: { ...d.criterion, ...patch } });
  const applyDraft = () => {
    if (!draft) return;
    setDraftTried(true);
    if (criterionErrors(draft.criterion, weighted).length > 0) return;
    change({
      criteria: draft.isNew
        ? [...criteria, draft.criterion]
        : criteria.map((c) =>
            c.id === draft.criterion.id ? draft.criterion : c,
          ),
    });
    setDraft(null);
  };

  // ---- Open / new / save ---------------------------------------------------
  const confirmDiscard = () =>
    !dirty || window.confirm("Discard your unsaved changes?");

  /** Opens a saved rubric to view and edit. Saving writes back to it. */
  const loadRubric = (key: string) => {
    const found = saved.find((r) => r.id === key);
    if (!found) return;
    if (!confirmDiscard()) {
      // The box already shows the pick; put back the open rubric's name.
      setSearch(saved.find((r) => r.id === loadedId)?.rubric.title ?? "");
      return;
    }
    setRubric(cloneRubric(found.rubric));
    setLoadedId(found.id);
    setRatings({});
    setShowErrors(false);
    setUndo(null);
    setDirty(false);
    setStatus({
      tone: "ok",
      text: `Opened "${found.rubric.title}". Saving updates it.`,
    });
  };

  const newRubric = () => {
    if (!confirmDiscard()) return;
    setRubric(blankRubric());
    setLoadedId(null);
    setSearch("");
    setRatings({});
    setShowErrors(false);
    setUndo(null);
    setDirty(false);
    setStatus(null);
  };

  const hasErrors =
    !rubric.title.trim() ||
    criteria.length === 0 ||
    criteria.some((c) => criterionErrors(c, weighted).length > 0);

  const save = () => {
    setShowErrors(true);
    if (hasErrors) {
      setStatus({ tone: "error", text: "Fix the highlighted fields first." });
      return;
    }
    const snapshot = cloneRubric(rubric);
    const id = loadedId ?? uid();
    // A brand-new rubric was just created: clear any leftover search text.
    if (!loadedId) setSearch("");
    setSaved((list) =>
      list.some((r) => r.id === id)
        ? list.map((r) => (r.id === id ? { ...r, rubric: snapshot } : r))
        : [...list, { id, owner: "You", rubric: snapshot }],
    );
    setLoadedId(id);
    setDirty(false);
    setUndo(null);
    onSave?.(snapshot, id);
    setStatus({ tone: "ok", text: `Saved "${snapshot.title}".` });
  };

  // ---- Preview -------------------------------------------------------------
  const totalWeight = criteria.reduce(
    (sum, c) => sum + effectiveWeight(rubric, c),
    0,
  );
  const result = scoreRubric(rubric, ratings);
  const complete =
    criteria.length > 0 &&
    result.rated === criteria.length &&
    criteria.every(isValidScale);

  const draftErrors = draft ? criterionErrors(draft.criterion, weighted) : [];

  return (
    <div className="flex flex-col gap-4 font-figtree">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="m-0 text-2xl font-bold">Rubric</h1>
        <button type="button" className={BTN_DARK} onClick={save}>
          Save rubric
        </button>
      </div>
      <StatusLine status={status} />
      {undo && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl bg-highlight px-4 py-2.5 text-[15px] text-heavy"
        >
          <span>
            Deleted &ldquo;{undo.criterion.name.trim() || "Untitled criterion"}
            &rdquo;.
          </span>
          <button type="button" className={BTN_OUTLINE} onClick={undoRemove}>
            Undo
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* ----------------------------- Editor ---------------------------- */}
        <div className="flex min-w-0 flex-col gap-3">
          <section
            aria-label="Rubric details"
            className={`${CARD} gap-3 sm:p-4`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-sm ${MUTED}`}>Open a rubric</span>
              <SearchAutocomplete
                className="w-auto min-w-[220px] flex-1"
                placeholder="Search rubrics…"
                options={saved.map((r) => ({
                  id: r.id,
                  label: r.rubric.title,
                }))}
                value={search}
                onChange={setSearch}
                onSelect={(option) => loadRubric(option.id)}
              />
              {loadedId && (
                <button
                  type="button"
                  className={BTN_OUTLINE}
                  onClick={newRubric}
                >
                  New rubric
                </button>
              )}
            </div>
            <p className={`m-0 text-[13px] ${MUTED}`}>
              {loadedId
                ? `Editing a saved rubric${dirty ? " · unsaved changes" : ""}`
                : "New rubric, not saved yet"}
            </p>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="rubric-title" className={`text-sm ${MUTED}`}>
                Name
              </label>
              <input
                id="rubric-title"
                className={`${FIELD} w-full px-3`}
                placeholder="e.g. Best Use of Our API"
                value={rubric.title}
                onChange={(e) => change({ title: e.target.value })}
              />
              {showErrors && !rubric.title.trim() && (
                <p className="m-0 text-sm text-destructive">
                  Give the rubric a name.
                </p>
              )}
            </div>
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={weighted}
                onChange={(e) => change({ weighted: e.target.checked })}
              />
              <span className="text-[15px] font-semibold">
                Weight criteria
              </span>
              <span className={`text-sm ${MUTED}`}>
                (off: every criterion counts equally)
              </span>
            </label>
          </section>

          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {criteria.map((c, index) => {
              const errors = criterionErrors(c, weighted);
              const label = c.name.trim();
              const name = label || `criterion ${index + 1}`;
              return (
                <li
                  key={c.id}
                  ref={(el) => {
                    if (el) itemRefs.current.set(c.id, el);
                    else itemRefs.current.delete(c.id);
                  }}
                  className="flex items-stretch gap-2"
                >
                  <button
                    type="button"
                    aria-label={`Edit ${name}`}
                    onClick={() => openEdit(c)}
                    className={`flex min-w-0 flex-1 flex-col gap-1 rounded-xl border border-gray-1 bg-white px-4 py-2.5 text-left hover:bg-offwhite ${focusRing}`}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[15px] font-bold ${label ? "" : MUTED}`}
                      >
                        {label || `Criterion ${index + 1}`}
                      </span>
                      <span className={CHIP}>
                        {isValidScale(c) ? `${c.min} to ${c.max}` : "Bad scale"}
                      </span>
                      {weighted && (
                        <span className={CHIP}>
                          weight {c.weight}x ·{" "}
                          {Math.round(
                            (effectiveWeight(rubric, c) / totalWeight) * 100,
                          )}
                          %
                        </span>
                      )}
                      {showErrors && errors.length > 0 && (
                        <span
                          className={`${CHIP} border-destructive text-destructive`}
                        >
                          Needs attention
                        </span>
                      )}
                    </span>
                    <span className={`truncate text-sm ${MUTED}`}>
                      {c.description.trim() || "No description"}
                    </span>
                  </button>
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Move ${name} up`}
                      className={`${BTN_OUTLINE} min-w-11 px-0`}
                      disabled={index === 0}
                      onClick={() => moveCriterion(c.id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${name} down`}
                      className={`${BTN_OUTLINE} min-w-11 px-0`}
                      disabled={index === criteria.length - 1}
                      onClick={() => moveCriterion(c.id, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${name}`}
                      className={`${BTN_OUTLINE} flex min-w-11 items-center justify-center px-0 text-destructive`}
                      onClick={() => removeCriterion(c.id)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </span>
                </li>
              );
            })}
          </ol>

          {showErrors && criteria.length === 0 && (
            <p className="m-0 text-sm text-destructive">
              Add at least one criterion.
            </p>
          )}

          <button
            type="button"
            className={`${BTN_OUTLINE} w-full text-left`}
            onClick={openNew}
          >
            Add criterion
          </button>
        </div>

        {/* ----------------------------- Preview --------------------------- */}
        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <p className={`mb-2 text-sm font-semibold ${MUTED}`}>
            What judges will see
          </p>
          <div className="mx-auto flex w-full max-w-sm flex-col gap-2 rounded-2xl border border-gray-1 bg-offwhite p-3">
            <p className={`m-0 truncate px-1 text-[13px] ${MUTED}`}>
              {rubric.title.trim() || "Untitled rubric"}
            </p>
            <section
              aria-label="Score this team (preview)"
              className={`${card} flex flex-col gap-2 px-3.5 py-3`}
            >
              {hasGuide(rubric) && (
                <button
                  type="button"
                  aria-expanded={guideOpen}
                  aria-controls="rubric-guide"
                  onClick={() => setGuideOpen((o) => !o)}
                  className={`min-h-[44px] self-end text-sm font-bold text-[#5b3fa0] hover:text-[#3f2a75] ${focusRing}`}
                >
                  {guideOpen
                    ? "Hide what the points mean"
                    : "What do the points mean?"}
                </button>
              )}
              {criteria.length === 0 ? (
                <p className={`m-0 text-sm ${MUTED}`}>
                  Add a criterion to see it here.
                </p>
              ) : (
                <RubricScorer
                  rubric={rubric}
                  ratings={ratings}
                  onRate={(id, value) =>
                    setRatings((r) => ({ ...r, [id]: value }))
                  }
                  guideOpen={guideOpen}
                />
              )}
            </section>
            <button
              type="button"
              disabled={!complete}
              className={primaryButton}
            >
              {complete
                ? `Submit ${result.label} & next team`
                : `${result.rated} of ${criteria.length} scored`}
            </button>
            <p className={`m-0 px-1 text-[13px] ${MUTED}`}>
              {complete
                ? `Saved as ${result.score} out of 100.`
                : "Tap the points to try it. Nothing here is saved."}
            </p>
          </div>
        </aside>
      </div>

      {/* ------------------------- Criterion dialog ------------------------- */}
      <Dialog
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) setDraft(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          {draft && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {draft.isNew ? "Add criterion" : "Edit criterion"}
                </DialogTitle>
                <DialogDescription>
                  Judges see the name and description, then tap a point.
                </DialogDescription>
              </DialogHeader>

              <form
                className="flex flex-col gap-3"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  applyDraft();
                }}
              >
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="d-name" className={`text-sm ${MUTED}`}>
                    Name
                  </label>
                  <input
                    id="d-name"
                    autoFocus
                    className={`${FIELD} w-full px-3`}
                    placeholder="e.g. Technical difficulty"
                    value={draft.criterion.name}
                    onChange={(e) => patchDraft({ name: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="d-desc" className={`text-sm ${MUTED}`}>
                    Short description
                  </label>
                  <input
                    id="d-desc"
                    className={`${FIELD} w-full px-3`}
                    placeholder="What should judges look for?"
                    maxLength={MAX_DESCRIPTION}
                    value={draft.criterion.description}
                    onChange={(e) =>
                      patchDraft({ description: e.target.value })
                    }
                  />
                  <span className={`text-right text-xs ${MUTED}`}>
                    {draft.criterion.description.length}/{MAX_DESCRIPTION}
                  </span>
                </div>

                <div
                  className={`grid gap-3 ${weighted ? "grid-cols-3" : "grid-cols-2"}`}
                >
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="d-min" className={`text-sm ${MUTED}`}>
                      Lowest point
                    </label>
                    <input
                      id="d-min"
                      type="number"
                      min={0}
                      max={MAX_POINT}
                      className={`${FIELD} w-full`}
                      value={draft.criterion.min}
                      onChange={(e) => patchDraft({ min: num(e) })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="d-max" className={`text-sm ${MUTED}`}>
                      Highest point
                    </label>
                    <input
                      id="d-max"
                      type="number"
                      min={0}
                      max={MAX_POINT}
                      className={`${FIELD} w-full`}
                      value={draft.criterion.max}
                      onChange={(e) => patchDraft({ max: num(e) })}
                    />
                  </div>
                  {weighted && (
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="d-weight" className={`text-sm ${MUTED}`}>
                        Weight
                      </label>
                      <input
                        id="d-weight"
                        type="number"
                        min={0}
                        step={0.5}
                        className={`${FIELD} w-full`}
                        value={draft.criterion.weight}
                        onChange={(e) => patchDraft({ weight: num(e) })}
                      />
                    </div>
                  )}
                </div>

                <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                  <legend className={`p-0 text-sm ${MUTED}`}>
                    What the points mean (optional)
                  </legend>
                  {(
                    [
                      ["low", "Lowest point means"],
                      ["mid", "Middle means"],
                      ["high", "Highest point means"],
                    ] as const
                  ).map(([key, label]) => (
                    <input
                      key={key}
                      aria-label={label}
                      placeholder={label}
                      className={`${FIELD} w-full px-3`}
                      value={draft.criterion[key]}
                      onChange={(e) => patchDraft({ [key]: e.target.value })}
                    />
                  ))}
                </fieldset>

                {draftTried && draftErrors.length > 0 && (
                  <ul className="m-0 flex list-none flex-col gap-1 p-0">
                    {draftErrors.map((message) => (
                      <li key={message} className="text-sm text-destructive">
                        {message}
                      </li>
                    ))}
                  </ul>
                )}

                <DialogFooter className="gap-2 sm:justify-between">
                  <span className="flex gap-2">
                    {!draft.isNew && (
                      <>
                        <button
                          type="button"
                          className={BTN_OUTLINE}
                          onClick={() => {
                            duplicateCriterion(draft.criterion.id);
                            setDraft(null);
                          }}
                        >
                          Duplicate
                        </button>
                        <button
                          type="button"
                          className={BTN_OUTLINE}
                          onClick={() => {
                            removeCriterion(draft.criterion.id);
                            setDraft(null);
                          }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      className={BTN_OUTLINE}
                      onClick={() => setDraft(null)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className={BTN_DARK}>
                      {draft.isNew ? "Add" : "Done"}
                    </button>
                  </span>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}