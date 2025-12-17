# EOF Stats

An Obsidian plugin that displays file statistics (URLs, Links) and an EOF indicator at the end of markdown files.

## Features

- **URL Count**: Shows the number of unique URLs in the document
- **Link Count**: Shows the number of unique internal links (`[[...]]`)
- **EOF Indicator**: Visual end-of-file marker with customizable style
- **Customizable Colors**: Configure colors for stats, lines, and EOF text
- **Toggle Options**: Show/hide individual statistics
- **Works in both Live Preview and Reading View**

## Installation

### From Community Plugins (Recommended)

1. Open Obsidian Settings
2. Go to Community plugins
3. Click "Browse" and search for "EOF Stats"
4. Click "Install" and then "Enable"

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release
2. Create a folder `eof-stats` in your vault's `.obsidian/plugins/` directory
3. Copy the downloaded files into the folder
4. Reload Obsidian and enable the plugin in Settings > Community plugins

## Settings

### Display Items

- **Show URLs**: Toggle display of unique URL count
- **Show Links**: Toggle display of unique internal link count

### Colors

- **Stats Color**: Color for the statistics text
- **Line Color**: Color for the horizontal lines
- **EOF Color**: Color for the "EOF" text

## Usage

Once enabled, the plugin automatically displays statistics and an EOF indicator at the end of each markdown file:

```
URLs: 5 | Links: 12
───────────────────────────────
              EOF
───────────────────────────────
```

## License

MIT License - see [LICENSE](LICENSE) for details.
