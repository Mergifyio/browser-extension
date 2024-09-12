
VERSION_DEFAULT = dev
GITHUB_DOMAIN_DEFAULT = github.com
MERGIFY_DOMAIN_DEFAULT = dashboard.mergify.com
BROWSER_INSTALLATION_TEMPLATE = unknown-browser

VERSION ?= $(VERSION_DEFAULT)
GITHUB_DOMAIN ?= $(GITHUB_DOMAIN_DEFAULT)
MERGIFY_DOMAIN ?= $(MERGIFY_DOMAIN_DEFAULT)

TARGETS = mergify-firefox-$(VERSION).zip mergify-chrome-$(VERSION).zip

all: $(TARGETS)
	@ls -la $(TARGETS)


firefox:

chrome:


mergify-%-${VERSION}.zip: %
	@echo "* Building $@..."
	rm -rf build $@
	cp -a src build
	sed -i \
		-e 's/$(GITHUB_DOMAIN_DEFAULT)/$(GITHUB_DOMAIN)/g' \
		-e 's/$(MERGIFY_DOMAIN_DEFAULT)/$(MERGIFY_DOMAIN)/g' \
		-e "s/$(BROWSER_INSTALLATION_TEMPLATE)/$</g" \
		build/mergify.js build/manifest.json build/sendInstallState.js
	cd build ; zip ../$@ *
	rm -rf build
	@echo
