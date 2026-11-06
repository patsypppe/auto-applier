// Puts the filter chips the page sends in its address over the saved filters, for one request, so the page can narrow
// or widen the feed without changing settings.json.
import { DEGREES } from "../matching/degree"
import { JOB_TYPES, LEVELS, WORKPLACES, type Filters } from "../settings"

// Reads a comma-separated list of known values, "any" for none, or throws a message naming the values it takes.
function listParam<T extends string>(params: URLSearchParams, name: string, known: readonly T[]): T[] | undefined {
  const value = params.get(name)
  if (value === null) return undefined
  if (value === "any") return []
  const items = value.split(",").map((item) => item.trim()).filter((item) => item !== "")
  if (!items.every((item) => known.some((name) => name === item))) throw new Error(`${name} may only use ${known.join(", ")}.`)
  return items as T[]
}

// Reads a whole number at least the given minimum, or throws the given message.
function numberParam(params: URLSearchParams, name: string, minimum: number, message: string): number | undefined {
  const value = params.get(name)
  if (value === null) return undefined
  if (!/^\d+$/.test(value) || Number(value) < minimum) throw new Error(message)
  return Number(value)
}

// Returns the saved filters with every chip the page sent put over them, or throws a message for the first value it cannot use.
export function filtersFromQuery(saved: Filters, params: URLSearchParams): Filters {
  const within = numberParam(params, "within", 1, "within must be a whole number of days above 0.")
  const maxYears = numberParam(params, "maxYears", 0, "maxYears must be a whole number of years, 0 or more.")
  const minPay = numberParam(params, "minPay", 0, "minPay must be a whole number of dollars, 0 or more.")
  const workplaces = listParam(params, "workplace", WORKPLACES)
  const jobTypes = listParam(params, "jobType", JOB_TYPES)
  const levels = listParam(params, "level", LEVELS)

  const degree = params.get("degree")
  if (degree !== null && degree !== "any" && !DEGREES.some((name) => name === degree)) {
    throw new Error(`degree must be any, ${DEGREES.slice(0, -1).join(", ")} or ${DEGREES.at(-1)}.`)
  }

  const { myDegree, ...rest } = saved
  const chosenDegree = degree === null ? myDegree : DEGREES.find((name) => name === degree)
  return {
    ...rest,
    ...(within === undefined ? {} : { postedWithinDays: within }),
    ...(maxYears === undefined ? {} : { maxYearsRequired: maxYears }),
    ...(minPay === undefined ? {} : { minYearlyPay: minPay }),
    ...(workplaces === undefined ? {} : { workplaces }),
    ...(jobTypes === undefined ? {} : { jobTypes }),
    ...(levels === undefined ? {} : { levels }),
    ...(chosenDegree ? { myDegree: chosenDegree } : {}),
  }
}
