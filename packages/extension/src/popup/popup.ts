// Popup script: mounts the "Fill this page" panel, the LLM settings and the profile form when the icon is clicked.
import { ChromeStorageProfileStore } from "../storage/ChromeStorageProfileStore"
import { ChromeStorageSettingsStore } from "../storage/ChromeStorageSettingsStore"
import { mountFillPanel } from "./FillPanel"
import { mountProfileForm } from "./ProfileForm"
import { mountSettingsPanel } from "./SettingsPanel"

const fillPanel = document.getElementById("fill-panel")
if (fillPanel) mountFillPanel(fillPanel)

const settingsBody = document.getElementById("settings-body")
if (settingsBody) void mountSettingsPanel(settingsBody, new ChromeStorageSettingsStore())

const app = document.getElementById("app")
if (app) void mountProfileForm(app, new ChromeStorageProfileStore())
