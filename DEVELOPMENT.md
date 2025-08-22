# Development Workflow

## Quick Start for Chrome Extension Development

### Option 1: Using npm (Recommended)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development mode:**
   ```bash
   npm start
   ```
   This will:
   - Create the development build in `dev-build/`
   - Start watching for file changes automatically with nodemon
   - Rebuild automatically when any `.js`, `.json`, or `.png` files change in `src/`

### Option 2: Using Make

1. **Start development mode:**
   ```bash
   make dev
   ```
   This will:
   - Create the development build in `dev-build/`
   - Show instructions for loading in Chrome
   - Start watching for file changes automatically

### Load extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked" 
   - Select the `dev-build` folder

### Development workflow:
   - Make changes to files in `src/`
   - The watcher will automatically rebuild `dev-build/`
   - In Chrome extensions page, click the refresh button on your extension
   - Press Ctrl+C to stop the watcher when done

### Clean development build:
   ```bash
   npm run dev:clean
   # or
   make dev-clean
   ```

## Available Scripts

### npm scripts (Recommended)
- `npm start` - Start development mode (build + watch)
- `npm run dev` - Same as npm start  
- `npm run dev:build` - Create development build only (no watch)
- `npm run dev:watch` - Start watching for changes (if build exists)
- `npm run dev:clean` - Clean development build
- `npm test` - Run tests
- `npm run lint` - Check code style
- `npm run format` - Format code

### Make Targets

- `make dev` - Create development build and start watching (recommended)
- `make dev-build` - Create development build only (no watch)
- `make dev-watch` - Start watching for changes (if build exists)
- `make dev-clean` - Clean development build
- `make help` - Show all available targets

## Testing

Run tests with:
```bash
npm test
```

The `__tests__` folder is automatically excluded from the development build.
