// Popup script: mounts the fill button, LLM settings, resume upload and profile form when the icon is clicked.
import { BackgroundLLMClient } from "../llm/BackgroundLLMClient"
import { readPdfInBrowser } from "../resume/browserPdfReader"
import { importResumeFile } from "../resume/importResumeFile"
import { ChromeStorageProfileStore } from "../storage/ChromeStorageProfileStore"
import { ChromeStorageSettingsStore } from "../storage/ChromeStorageSettingsStore"
import { IndexedDbResumeStore } from "../storage/IndexedDbResumeStore"
import { mountFillPanel } from "./FillPanel"
import { mountProfileForm } from "./ProfileForm"
import { mountResumePanel } from "./ResumePanel"
import { mountSettingsPanel } from "./SettingsPanel"

// Mounts every panel; the resume panel needs the profile form's handle, so the form goes first.
async function start(): Promise<void> {
  const profiles = new ChromeStorageProfileStore()

  const fillPanel = document.getElementById("fill-panel")
  if (fillPanel) mountFillPanel(fillPanel)

  const settingsBody = document.getElementById("settings-body")
  if (settingsBody) void mountSettingsPanel(settingsBody, new ChromeStorageSettingsStore())

  const app = document.getElementById("app")
  if (!app) return
  const form = await mountProfileForm(app, profiles)

  const resumePanel = document.getElementById("resume-panel")
  if (resumePanel) {
    mountResumePanel(resumePanel, {
      form,
      importFile: (file, current, carried) =>
        importResumeFile(file, current, carried, {
          readPdf: readPdfInBrowser,
          llm: new BackgroundLLMClient(),
          resumes: new IndexedDbResumeStore(),
          profiles,
        }),
    })
  }
}

void start()
