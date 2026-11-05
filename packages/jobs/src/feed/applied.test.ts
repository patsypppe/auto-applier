// Tests that setStatus records each change to a job's application status with its date, and clears a job on "none".
import { describe, expect, test } from "vitest"
import { setStatus, type AppliedEntry } from "./applied"

const JOB = { key: "greenhouse:acme:1", company: "Acme", title: "Data Analyst", url: "https://boards.example/1" }
const MONDAY = new Date("2026-11-02T15:00:00Z")
const FRIDAY = new Date("2026-11-06T18:00:00Z")

describe("setStatus", () => {
  test("adds a job the first time it gets a status, with today's date", () => {
    expect(setStatus([], JOB, "applied", MONDAY)).toEqual([
      { ...JOB, status: "applied", changes: [{ status: "applied", date: "2026-11-02T15:00:00.000Z" }] },
    ])
  })

  test("adds each later change to the job's list, keeping the earlier ones", () => {
    const history = setStatus(setStatus([], JOB, "applied", MONDAY), JOB, "interviewing", FRIDAY)

    expect(history[0]).toMatchObject({
      status: "interviewing",
      changes: [
        { status: "applied", date: MONDAY.toISOString() },
        { status: "interviewing", date: FRIDAY.toISOString() },
      ],
    })
  })

  test("does not record the same status twice in a row", () => {
    const history = setStatus(setStatus([], JOB, "applied", MONDAY), JOB, "applied", FRIDAY)

    expect(history[0]!.changes).toHaveLength(1)
  })

  test("keeps a note when one is given and leaves an earlier note when none is", () => {
    const withNote = setStatus([], JOB, "applied", MONDAY, "Referred by a classmate")
    const later = setStatus(withNote, JOB, "interviewing", FRIDAY)

    expect(later[0]!.note).toBe("Referred by a classmate")
  })

  test("removes the job when the status is set to none", () => {
    const other: AppliedEntry = { ...JOB, key: "greenhouse:acme:2", status: "saved", changes: [] }
    const history = setStatus([other, ...setStatus([], JOB, "applied", MONDAY)], JOB, "none", FRIDAY)

    expect(history.map((entry) => entry.key)).toEqual(["greenhouse:acme:2"])
  })

  test("leaves the other jobs untouched", () => {
    const other: AppliedEntry = { ...JOB, key: "greenhouse:acme:2", status: "saved", changes: [] }

    expect(setStatus([other], JOB, "applied", MONDAY)[0]).toBe(other)
  })
})
