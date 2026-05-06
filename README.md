# Quick Dictionary

A Chrome extension that makes reading on the web faster and easier. Highlight a word or right-click a selected word to instantly see its definition, part of speech, phonetic pronunciation, and audio playback in a polished dark popup.

## Features

- Highlight any word on a page to look it up instantly
- Right-click selected text and choose QuickDictionary to open a lookup
- Click words inside definitions to explore related terms
- Draggable popup with smart on-screen positioning
- Audio pronunciation with animated playback button
- Saved words list for words you want to review later
- History view for recent lookups
- Press Escape or click away to dismiss
- Skeleton loading state and smooth popup animations

## Stack

- Vanilla JavaScript
- Chrome Extension Manifest V3
- Wiktionary REST API for definitions and related word data
- Free Dictionary API for pronunciation and audio
- Material-style dark UI
- Roboto typography

## Installation

1. Clone or download this repository.
2. Extract the final fixed version of the extension files into a folder.
3. Open `chrome://extensions` in Chrome.
4. Enable **Developer mode**.
5. Click **Load unpacked**.
6. Select the project folder for the final fixed build.

## Notes

- The extension popup opens from the toolbar icon and shows your history and saved words.
- The on-page popup appears when you select a word or use the context menu.
- If you are updating from an older local build, remove the old unpacked extension first and reload the latest folder.
