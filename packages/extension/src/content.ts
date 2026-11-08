// Content script: fills the page (or a whole multi-step form) when the popup asks, using the saved profile and the LLM through the background worker.
import { BackgroundFlowState } from "./fill/BackgroundFlowState"
import { pendingStep } from "./fill/resumeFlow"
import { runFill } from "./fill/runFill"
import { runFlow } from "./fill/runFlow"
import { BackgroundLLMClient } from "./llm/BackgroundLLMClient"
import { isFillAndContinueRequest, isFillPageRequest, isStopFlowRequest } from "./messaging"
import { loadResumeFromBackground } from "./resume/loadResumeFromBackground"
import type { FillProgressMessage, FillResultMessage, PageLoadedMessage } from "./messaging"
import { ChromeStorageProfileStore } from "./storage/ChromeStorageProfileStore"

// Sends the result to the extension, where the background worker saves it for the popup, open or not.
function reportResult(message: FillResultMessage): void {
  chrome.runtime.sendMessage(message).catch(() => undefined)
}

// Sends how far the fill has got to the extension, where the background worker saves it for the popup's progress bar.
function reportProgress(progress: FillProgressMessage["progress"]): void {
  const message: FillProgressMessage = { type: "fill-progress", progress }
  chrome.runtime.sendMessage(message).catch(() => undefined)
}

// The top page tells the background worker it has loaded, so results saved for the previous page are dropped.
if (window === window.top) {
  const loaded: PageLoadedMessage = { type: "page-loaded" }
  chrome.runtime.sendMessage(loaded).catch(() => undefined)
}

const flowState = new BackgroundFlowState()
const RESUME_DELAY_MS = 1000
let stopRequested = false

// Fills this step and carries on through the form's next steps, stopping before Submit, then reports the result.
function startFlow(startAt: number): void {
  stopRequested = false
  void runFlow({
    store: new ChromeStorageProfileStore(),
    llm: new BackgroundLLMClient(),
    flowState,
    loadResume: loadResumeFromBackground,
    onProgress: reportProgress,
    isStopped: () => stopRequested,
    startAt,
  }).then(reportResult)
}

// After a page load, carries on a flow that pressed Next a moment ago, once the page has had time to draw.
void pendingStep(flowState).then((step) => {
  if (step !== undefined) setTimeout(() => startFlow(step), RESUME_DELAY_MS)
})

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (isFillPageRequest(message)) {
    void runFill(new ChromeStorageProfileStore(), new BackgroundLLMClient(), loadResumeFromBackground, reportProgress).then(reportResult)
  } else if (isFillAndContinueRequest(message)) {
    startFlow(0)
  } else if (isStopFlowRequest(message)) {
    stopRequested = true
    void flowState.clear().catch(() => undefined)
  }
})
