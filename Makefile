
VERSION_DEFAULT = dev
GITHUB_DOMAIN_DEFAULT = github.com
MERGIFY_DOMAIN_DEFAULT = dashboard.mergify.com
BROWSER_INSTALLATION_TEMPLATE = unknown-browser

VERSION ?= $(VERSION_DEFAULT)
GITHUB_DOMAIN ?= $(GITHUB_DOMAIN_DEFAULT)
MERGIFY_DOMAIN ?= $(MERGIFY_DOMAIN_DEFAULT)

TARGETS = mergify-firefox-$(VERSION).zip mergify-chrome-$(VERSION).zip mergify-safari-$(VERSION).zip

all: $(TARGETS)
	@ls -la $(TARGETS)

firefox:

chrome:

safari:

safariTMP:


mergify-%-${VERSION}.zip: %
	@echo "* Building $@..."
	rm -rf build $@
	cp -a src build
	rm -rf build/__tests__
	sed -i \
		-e 's/#VERSION#/$(VERSION)/g' \
		-e 's/$(GITHUB_DOMAIN_DEFAULT)/$(GITHUB_DOMAIN)/g' \
		-e 's/$(MERGIFY_DOMAIN_DEFAULT)/$(MERGIFY_DOMAIN)/g' \
		-e "s/$(BROWSER_INSTALLATION_TEMPLATE)/$</g" \
		build/mergify.js build/manifest.json build/sendInstallState.js
	cd build ; zip ../$@ *
	rm -rf build
	@echo

mergify-safari-${VERSION}.zip: mergify-safariTMP-$(VERSION).zip
	rm -rf safari
	mkdir -p safari/src
	(cd safari/src && unzip ../../$<)
	xcrun /Applications/Xcode.app/Contents/Developer/usr/bin/safari-web-extension-converter \
		--macos-only \
		--project-location safari \
		--force \
		--no-open \
		--no-prompt \
		--app-name mergify \
	    safari/src

	(cd safari/mergify && \
		xcodebuild -scheme mergify -configuration Release && \
	    xcodebuild -scheme mergify -archivePath ./build/mergify-safari-${VERSION}.xcarchive archive)

	# TODO(sileht): sign the package
	# xcodebuild -exportArchive -archivePath ./build/mergify-safari-${VERSION}.xcarchive -exportPath ./build -exportOptionsPlist ../../ExportOptions.plist 
	cd safari/mergify/build/mergify-safari-${VERSION}.xcarchive ; zip ../../../../$@ *

	rm -rf safari $<
	@echo

