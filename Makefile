
APPLE_TEAM_ID=995U2925WN
VERSION_DEFAULT = dev
DEV_VERSION = 999.0.0
GITHUB_DOMAIN_DEFAULT = github.com
MERGIFY_DOMAIN_DEFAULT = dashboard.mergify.com
BROWSER_INSTALLATION_TEMPLATE = unknown-browser

VERSION ?= $(VERSION_DEFAULT)
GITHUB_DOMAIN ?= $(GITHUB_DOMAIN_DEFAULT)
MERGIFY_DOMAIN ?= $(MERGIFY_DOMAIN_DEFAULT)

TARGETS = mergify-firefox-$(VERSION).zip mergify-chrome-$(VERSION).zip mergify-safari-$(VERSION).pkg
DEV_TARGETS = dev dev-build dev-watch dev-clean

.PHONY: all
all: $(TARGETS)
	@ls -la $(TARGETS)

.PHONY: help
help: ## Show this help.
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "%-15s %s\n", $$1, $$2}'

.PHONY: firefox
firefox: ## Build Firefox extension

.PHONY: chrome
chrome: ## Build Chrome extension

.PHONY: safari
safari: ## Build Safari extension

.PHONY: safariTMP
safariTMP:

# Development targets
.PHONY: dev
dev: ## Create development build and start watching for changes
	@echo "Starting development mode via npm..."
	npm start

.PHONY: dev-build
dev-build: ## Build development folder only (no watch)
	@echo "* Creating development build..."
	rm -rf dev-build
	cp -a src dev-build
	rm -rf dev-build/__tests__
	gsed -i \
		-e 's/__MERGIFY_DEBUG__ = false;/__MERGIFY_DEBUG__ = true;/g' \
		-e 's/#VERSION#/$(DEV_VERSION)/g' \
		-e 's/$(GITHUB_DOMAIN_DEFAULT)/$(GITHUB_DOMAIN)/g' \
		-e 's/$(MERGIFY_DOMAIN_DEFAULT)/$(MERGIFY_DOMAIN)/g' \
		-e "s/$(BROWSER_INSTALLATION_TEMPLATE)/chrome/g" \
		dev-build/mergify.js dev-build/manifest.json dev-build/sendInstallState.js
	@echo "Development build created in ./dev-build/"

.PHONY: dev-watch
dev-watch: ## Start watching for changes (build must exist)
	@echo "Starting file watcher via npm..."
	npm run dev:watch

.PHONY: dev-clean
dev-clean: ## Clean development build
	rm -rf dev-build
	@echo "Development build cleaned"


mergify-%-${VERSION}.zip: %
	@echo "* Building $@..."
	rm -rf build $@
	cp -a src build
	rm -rf build/__tests__
	gsed -i \
		-e 's/#VERSION#/$(VERSION)/g' \
		-e 's/$(GITHUB_DOMAIN_DEFAULT)/$(GITHUB_DOMAIN)/g' \
		-e 's/$(MERGIFY_DOMAIN_DEFAULT)/$(MERGIFY_DOMAIN)/g' \
		-e "s/$(BROWSER_INSTALLATION_TEMPLATE)/$</g" \
		build/mergify.js build/manifest.json build/sendInstallState.js
	cd build ; zip ../$@ *
	rm -rf build
	@echo

APPLE_APP_NAME=mergify-safari

mergify-safari-${VERSION}.pkg: mergify-safariTMP-$(VERSION).zip
	rm -rf safari
	mkdir -p safari/src
	(cd safari/src && unzip ../../$<)
	xcrun safari-web-extension-converter \
		--no-prompt \
		--force \
		--copy-resources \
		--macos-only \
		--no-open \
		--app-name $(APPLE_APP_NAME) \
		--bundle-identifier com.mergify.$(APPLE_APP_NAME) \
		--project-location safari \
	    safari/src

	cd safari/mergify-safari && xcrun agvtool new-marketing-version $(VERSION)

	PLIST="safari/$(APPLE_APP_NAME)/$(APPLE_APP_NAME).app/Contents/Info.plist"

	/usr/libexec/PlistBuddy -c "Add :LSApplicationCategoryType string public.app-category.developer-tools" "$PLIST" || \
	/usr/libexec/PlistBuddy -c "Set :LSApplicationCategoryType public.app-category.developer-tools" "$PLIST"

	/usr/libexec/PlistBuddy -c "Add :LSMinimumSystemVersion string 10.14" "$PLIST" || \
	/usr/libexec/PlistBuddy -c "Set :LSMinimumSystemVersion 10.14" "$PLIST"

ifeq ($(SIGN),1)
	xcodebuild \
		-project safari/$(APPLE_APP_NAME)/$(APPLE_APP_NAME).xcodeproj \
		-scheme $(APPLE_APP_NAME) \
		-configuration Release \
	    -archivePath safari/build.xcarchive \
		-sdk macosx \
		-derivedDataPath safari/build \
	    archive \
		ARCHS="arm64 x86_64" \
		ONLY_ACTIVE_ARCH=NO \
		CODE_SIGN_STYLE="Manual" \
		CODE_SIGN_IDENTITY="Developer ID Application: Mergify ($(APPLE_TEAM_ID))" \
		DEVELOPMENT_TEAM=$(APPLE_TEAM_ID) \
		OTHER_CODE_SIGN_FLAGS="--deep --timestamp"

	xcodebuild -exportArchive \
	    -archivePath safari/build.xcarchive \
	    -exportOptionsPlist ExportOptions.plist \
	    -exportPath safari/build/export \
		CODE_SIGN_STYLE="Manual" \
		CODE_SIGN_IDENTITY="Developer ID Application: Mergify ($(APPLE_TEAM_ID))" \
		DEVELOPMENT_TEAM=$(APPLE_TEAM_ID) \
		OTHER_CODE_SIGN_FLAGS="--deep --timestamp"

	codesign -vvv --deep --strict \
		 safari/build/export/${APPLE_APP_NAME}.app

	productbuild --component ./safari/build/export/$(APPLE_APP_NAME).app /Applications \
             --sign "Developer ID Installer: Mergify ($(APPLE_TEAM_ID))" \
			 $@
else
	xcodebuild \
		-project safari/$(APPLE_APP_NAME)/$(APPLE_APP_NAME).xcodeproj \
		-scheme $(APPLE_APP_NAME) \
		-configuration Release \
	    -archivePath safari/build.xcarchive \
		-sdk macosx \
		-derivedDataPath safari/build \
	    archive

	productbuild \
	  --component safari/build.xcarchive/Products/Applications/$(APPLE_APP_NAME).app /Applications \
	  $@

endif

	rm -rf safari $<
	@echo

.PHONY: clean
clean:
	rm -rf build safari mergify-*-*.zip mergify-safari-*.pkg
