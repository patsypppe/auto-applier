// Tests that readBoardArg reads "--board ats:slug" and explains what to type when it is wrong.
import { describe, expect, test } from "vitest"
import { readBoardArg } from "./boardArg"

const USAGE = "Use --board greenhouse:<slug>, for example --board greenhouse:stripe."

describe("readBoardArg", () => {
  test("reads the job site and the board slug", () => {
    expect(readBoardArg(["--board", "greenhouse:stripe"])).toEqual({ ats: "greenhouse", slug: "stripe" })
  })

  test("accepts the form with an equals sign", () => {
    expect(readBoardArg(["--board=greenhouse:stripe"])).toEqual({ ats: "greenhouse", slug: "stripe" })
  })

  test("refuses a missing board", () => {
    expect(() => readBoardArg([])).toThrow(USAGE)
  })

  test("refuses a job site it cannot read yet", () => {
    expect(() => readBoardArg(["--board", "workday:nvidia"])).toThrow(`'workday' is not supported yet. ${USAGE}`)
  })

  test("refuses a board with no slug", () => {
    expect(() => readBoardArg(["--board", "greenhouse:"])).toThrow(USAGE)
  })
})
