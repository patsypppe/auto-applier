// Popup script: mounts the profile form when the extension icon is clicked.
import { ChromeStorageProfileStore } from "../storage/ChromeStorageProfileStore"
import { mountProfileForm } from "./ProfileForm"

const app = document.getElementById("app")
if (app) void mountProfileForm(app, new ChromeStorageProfileStore())
