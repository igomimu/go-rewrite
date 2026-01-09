// @ts-nocheck
/// <reference types="chrome" />


chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));
