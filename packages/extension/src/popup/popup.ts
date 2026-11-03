// Popup script: mounts the "Fill this page" panel and the profile form when the extension icon is clicked.
import { ChromeStorageProfileStore } from "../storage/ChromeStorageProfileStore"
import { mountFillPanel } from "./FillPanel"
import { mountProfileForm } from "./ProfileForm"

const fillPanel = document.getElementById("fill-panel")
if (fillPanel) mountFillPanel(fillPanel)

const app = document.getElementById("app")
if (app) void mountProfileForm(app, new ChromeStorageProfileStore())
