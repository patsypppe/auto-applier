// Tests that clickLikeUser sends the full set of events, with coordinates and button states, that a real mouse click produces.
// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from "vitest"
import { clickLikeUser, fireChangeEvents } from "./events"

const RECORDED = ["pointerdown", "mousedown", "focus", "pointerup", "mouseup", "click"]

// Starts recording the events of interest on the element, in the order they arrive.
function record(element: HTMLElement): { order: string[]; events: Record<string, Event> } {
  const order: string[] = []
  const events: Record<string, Event> = {}
  for (const type of RECORDED) {
    element.addEventListener(type, (event) => {
      order.push(type)
      events[type] = event
    })
  }
  return { order, events }
}

beforeEach(() => {
  document.body.innerHTML = ""
})

describe("clickLikeUser", () => {
  test("sends pointer and mouse events in the order a real click does", () => {
    document.body.innerHTML = '<div id="option" role="option">Yes</div>'
    const option = document.getElementById("option") as HTMLElement
    const { order } = record(option)

    clickLikeUser(option)

    expect(order).toEqual(["pointerdown", "mousedown", "pointerup", "mouseup", "click"])
  })

  test("focuses a form control between the mouse down and the mouse up, as a real click does", () => {
    document.body.innerHTML = '<input id="field" />'
    const input = document.getElementById("field") as HTMLInputElement
    const { order } = record(input)

    clickLikeUser(input)

    expect(order).toEqual(["pointerdown", "mousedown", "focus", "pointerup", "mouseup", "click"])
    expect(document.activeElement).toBe(input)
  })

  test("leaves the focus alone when the target is not a form control", () => {
    document.body.innerHTML = '<input id="field" /><div id="option" role="option">Yes</div>'
    const input = document.getElementById("field") as HTMLInputElement
    input.focus()

    clickLikeUser(document.getElementById("option") as HTMLElement)

    expect(document.activeElement).toBe(input)
  })

  test("reports the left button, the pressed state and one click", () => {
    document.body.innerHTML = '<div id="option"></div>'
    const option = document.getElementById("option") as HTMLElement
    const { events } = record(option)

    clickLikeUser(option)

    const down = events.mousedown as MouseEvent
    const up = events.mouseup as MouseEvent
    const click = events.click as MouseEvent
    expect([down.button, down.buttons, down.detail]).toEqual([0, 1, 1])
    expect([up.button, up.buttons, up.detail]).toEqual([0, 0, 1])
    expect([click.button, click.buttons, click.detail]).toEqual([0, 0, 1])
  })

  test("reports the middle of the element as the pointer position", () => {
    document.body.innerHTML = '<div id="option"></div>'
    const option = document.getElementById("option") as HTMLElement
    option.getBoundingClientRect = () => ({ left: 10, top: 20, width: 100, height: 40 }) as DOMRect
    const { events } = record(option)

    clickLikeUser(option)

    const down = events.mousedown as MouseEvent
    expect([down.clientX, down.clientY]).toEqual([60, 40])
  })

  test("sends events that bubble, so a handler on a parent sees them", () => {
    document.body.innerHTML = '<div id="parent"><div id="child"></div></div>'
    const parent = document.getElementById("parent") as HTMLElement
    const { order } = record(parent)

    clickLikeUser(document.getElementById("child") as HTMLElement)

    expect(order).toContain("mousedown")
    expect(order).toContain("click")
  })
})

describe("fireChangeEvents", () => {
  test("sends bubbling input and change events", () => {
    document.body.innerHTML = '<input id="field" />'
    const input = document.getElementById("field") as HTMLInputElement
    const seen: string[] = []
    document.body.addEventListener("input", () => seen.push("input"))
    document.body.addEventListener("change", () => seen.push("change"))

    fireChangeEvents(input)

    expect(seen).toEqual(["input", "change"])
  })
})
