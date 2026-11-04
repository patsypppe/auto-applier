// Tests that readBoardArgs reads every "--board site:slug" option and explains what to type when one is wrong.
import { describe, expect, test } from "vitest"
import { readBoardArgs } from "./boardArg"

const USAGE = "Use --board <site>:<slug>, for example --board greenhouse:stripe. Sites: greenhouse, lever, ashby."

describe("readBoardArgs", () => {
  test("reads the job site and the board slug", () => {
    expect(readBoardArgs(["--board", "greenhouse:stripe"])).toEqual([{ ats: "greenhouse", slug: "stripe" }])
  })

  test("reads several boards, in both forms, in order", () => {
    expect(readBoardArgs(["--board", "lever:spotify", "--fresh", "--board=ashby:ramp"])).toEqual([
      { ats: "lever", slug: "spotify" },
      { ats: "ashby", slug: "ramp" },
    ])
  })

  test("refuses a missing board", () => {
    expect(() => readBoardArgs(["--fresh"])).toThrow(USAGE)
  })

  test("refuses a job site it cannot read yet", () => {
    expect(() => readBoardArgs(["--board", "workday:nvidia"])).toThrow(`'workday' is not supported yet. ${USAGE}`)
  })

  test("refuses a board with no slug", () => {
    expect(() => readBoardArgs(["--board", "greenhouse:"])).toThrow(USAGE)
  })
})
