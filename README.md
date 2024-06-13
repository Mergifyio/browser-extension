# Mergify Chrome extension


![Screenshot of Mergify Chrome extension](/marketplace-materials/screenshot.png)

## Install

Go to [Google Chrome web store](https://chromewebstore.google.com/detail/mergify/idhdcccjlcijifdphaicgnmhifpmilge).

## Build

To prepare the zip to upload to Google Web Store Developer Dashboard
```
$ make
```


To build the zip for an onpremise installation:
```
$ make GITHUB_DOMAIN=ghes.company.com MERGIFY_DOMAIN=mergify.company.com
```
