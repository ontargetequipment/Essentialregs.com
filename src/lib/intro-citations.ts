/**
 * The rule for a question map's introduction (9 Oct 2026): a sentence that
 * states a date, a threshold or an applicability conclusion carries the
 * provisions that support it, like a premise note's sentences. The outside
 * reviewer's pass found the engines map's one-sentence introduction listing
 * dates and applicability conditions with nothing behind them; a visitor
 * cannot check a sentence that does not say where it comes from.
 *
 * `introNeedsCitation` is the test the unit suite applies to every
 * introduction: a month name, a four-digit year, a number with a unit or
 * threshold word, or applicability wording. Deliberately broad: a sentence
 * that trips it and has no provision behind it should be cited or reworded,
 * not exempted. Pure.
 */

const MONTH = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\b\.?\s+\d{1,2}\b|\b(?:January|February|March|April|June|July|August|September|October|November|December)\b/;
const YEAR = /\b(?:19|20)\d{2}\b/;
const NUMBER_UNIT =
  /\d[\d,.]*\s*(?:-|\s)?(?:hp|horsepower|tpy|tons?|bbl|barrels?|%|percent|ppmv?|feet|foot|ft|hours?|hr|days?|months?|years?|gallons?|scfh|standard cubic feet|pounds?|lbs?|acres?|kw|kilowatts?|dollars?|\$)\b|\d\s*%|\$\s*\d/i;
const APPLICABILITY = /\b(?:applies|apply|applied|applicable|applicability|subject to|required|requires?|requirements?|must|reaches|open only|may register|may be subject)\b/i;

/** Whether a sentence states a date, a threshold or an applicability conclusion, and so needs a citation. */
export function introNeedsCitation(text: string): boolean {
  return MONTH.test(text) || YEAR.test(text) || NUMBER_UNIT.test(text) || APPLICABILITY.test(text);
}
