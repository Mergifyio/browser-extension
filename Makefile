
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
	gsed -i \
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
	xcrun safari-web-extension-converter \
		--macos-only \
		--project-location safari \
		--bundle-identifier com.mergify.safari-extension \
		--force \
		--no-open \
		--no-prompt \
		--copy-resources \
		--app-name mergify \
	    safari/src

	xcodebuild \
		-project safari/mergify/mergify.xcodeproj \
		-scheme mergify \
		-configuration Release \
	    -archivePath safari/build.xcarchive \
	    archive

	ditto -c -k --sequesterRsrc --keepParent \
		./safari/build.xcarchive/Products/Applications/mergify.app $@

	rm -rf safari $<
	@echo

clean:
	rm -rf build safari mergify-*-*.zip
