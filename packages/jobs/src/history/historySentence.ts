// Puts a company's H-1B history into one plain sentence, for the feed page and the top command.
import type { EmployerHistory } from "./matchEmployer"

// Describes the company's H-1B filings in one sentence, saying plainly when none were found or the name was unclear.
export function historySentence(history: EmployerHistory): string {
  if (history.status === "matched") {
    return `USCIS approved ${history.approvals.toLocaleString("en-US")} H-1B petitions for ${history.employer} in FY${history.fiscalYear}, ${history.newEmploymentApprovals.toLocaleString("en-US")} of them for new employment.`
  }
  if (history.status === "ambiguous") {
    return `Several employers in the FY${history.fiscalYear} H-1B data share this name (${history.candidates.slice(0, 3).join(", ")}), so none is shown.`
  }
  return `No FY${history.fiscalYear} H-1B approvals found under this name. The company may file under another legal name.`
}
