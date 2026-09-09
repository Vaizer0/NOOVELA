# NOOVELA

A fully functional, production-ready web novel and manga reader — migrated from the [NoveLA Android app](https://github.com/Hndk0/NoveLA).

**Live:** https://vaizer0.github.io/NOOVELA/

## Features

- **Library** — manage your novel & manga collection with grid/list views, sorting, filtering
- **Extensions/Plugins** — install JS-based source extensions from URL or the community index
- **Reader** — configurable font, size, line height, themes (20 themes), text alignment
- **TTS** — Web Speech API with real boundary-event word highlighting (no drift, accurate sync)
- **Translation** — Google (free), Gemini, OpenAI — batch paragraph translation with caching
- **Manga** — webtoon scroll and pager modes, lazy image loading, touch swipe
- **History** — reading history with resume from last position
- **Migration** — move books between extension sources
- **Backup** — JSON export/import; EPUB/FB2 local file import
- **Cinematic UI** — animated star field + asteroid mini-game background
- **PWA** — offline support via Service Worker, installable
- **20 Themes** — Default, Dark, Light, Material You, Catppuccin, Nord, Matrix, and more
- **i18n** — English, Russian, Chinese, Japanese, Korean, Arabic, and more

## Structure

```
/
  index.html          SPA shell
  sw.js               Service Worker
  manifest.json       PWA manifest
  css/
    main.css          Themes, layout, components
    reader.css        Reader & TTS styles
  js/
    i18n.js           Internationalization
    db.js             IndexedDB persistence
    settings.js       User settings
    scraper.js        Proxy fetch utilities
    utils.js          UI helpers, toast, debounce
    plugins.js        Extension engine
    tts.js            TTS word-boundary engine
    translation.js    Multi-provider translation
    backup.js         Backup, restore, EPUB import
    epub.js           EPUB/FB2 parser
    reader.js         Novel reader logic
    manga.js          Manga viewer logic
    library.js        Library screen
    catalog.js        Book info + Finder screen
    search.js         Global search
    extensions.js     Extensions screen
    migration.js      Source migration
    minigames.js      Background star field + asteroid game
    app.js            App boot, routing, settings UI
  assets/
    icon.svg          App icon
  .github/workflows/
    deploy.yml        GitHub Pages deployment
```

## Deploy

Auto-deployed to GitHub Pages on every push to `main` via GitHub Actions.

## Usage

1. Open the live URL in any modern browser
2. Go to **Extensions** tab and install a source
3. Use **Find** tab to browse and add books
4. Tap any book to read — TTS auto-highlights each word as it speaks
