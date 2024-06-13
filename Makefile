
GITHUB_DOMAIN_DEFAULT = github.com
MERGIFY_DOMAIN_DEFAULT = dashboard.mergify.com

GITHUB_DOMAIN ?= $(GITHUB_DOMAIN_DEFAULT)
MERGIFY_DOMAIN ?= $(MERGIFY_DOMAIN_DEFAULT)

zip:
	rm -rf build
	cp -a src build
	sed -i \
		-e 's/$(GITHUB_DOMAIN_DEFAULT)/$(GITHUB_DOMAIN)/g' \
		-e 's/$(MERGIFY_DOMAIN_DEFAULT)/$(MERGIFY_DOMAIN)/g' \
		build/mergify.js build/manifest.json
	cd build ; zip ../mergify.zip *
	rm -rf build
