// Turns jobs and degrees into short readable lines, for showing the user what a resume contained.
import type { Education, WorkExperience } from "../profile/types"

// Formats a date range: one date when the start and end match, and "Present" when there is no end.
function period(startDate: string, endDate: string | undefined): string {
  if (endDate === undefined) return `${startDate} – Present`
  return endDate === startDate ? startDate : `${startDate} – ${endDate}`
}

// Describes one job as "Title at Company (dates)".
function describeJob(job: WorkExperience): string {
  return `${job.title} at ${job.company} (${period(job.startDate, job.endDate)})`
}

// Describes one degree as "Degree in Field, School (dates)", leaving out the field when there is none.
function describeDegree(degree: Education): string {
  const name = degree.field ? `${degree.degree} in ${degree.field}` : degree.degree
  return `${name}, ${degree.school} (${period(degree.startDate, degree.endDate)})`
}

// Returns one readable line per job and per degree, in the order given.
export function describeHistory(
  experience: WorkExperience[],
  education: Education[],
): { jobs: string[]; degrees: string[] } {
  return { jobs: experience.map(describeJob), degrees: education.map(describeDegree) }
}
