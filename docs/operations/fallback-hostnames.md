# Fallback Hostname Operations

Living Sites generated fallback hostnames from the Website ID and the configured suffix:

`<normalized-website-id>.<FALLBACK_DOMAIN_SUFFIX>`

`FALLBACK_DOMAIN_SUFFIX` defaulted to `livingsites.app` so existing behavior remained unchanged. The Domain layer received the complete hostname and no longer selected the platform suffix itself. Existing Website rows remained readable because resolution continued to compare the request hostname with the stored `custom_domain` and `fallback_domain` values.

## Netlify and DNS setup

The operator must own or control the configured suffix before enabling fallback delivery. For the current default contract:

1. Confirm the Netlify team and the existing `living-cms` project are eligible for wildcard subdomains, and have Netlify enable the wildcard-subdomain capability when the Domain management UI does not expose it. Do not create another project.
2. Assign the operator-controlled parent domain to the existing project and follow the project-specific Domain management verification prompts. Netlify's current wildcard-hosting requirements can constrain the primary domain and other aliases, so the operator must resolve those requirements before changing DNS.
3. Provide wildcard TLS coverage. Netlify DNS can provision wildcard certificates automatically; an external DNS setup may require an operator-provided wildcard certificate depending on the enabled Netlify wildcard configuration.
4. At the authoritative DNS provider for `livingsites.app`, create a wildcard CNAME record with host `*` and target `living-cms.netlify.app`, unless Netlify's project-specific Domain management instructions specify a different target. Add the custom domain in Netlify before creating the external CNAME.
5. If `livingsites.app` uses Netlify DNS, delegate the zone as directed by Netlify and use the Netlify-managed wildcard record/certificate workflow instead of duplicating external records.
6. Wait for DNS and certificate propagation, then run the readiness command below for a published Website with a published homepage.

Netlify requires a custom subdomain to be added to the project before external DNS points its CNAME at the project's `.netlify.app` hostname. Netlify's Domain management screen remains authoritative for project-specific DNS targets and certificate status.

## Readiness check

```sh
npm run fallback:verify -- \
  --hostname web-example-id.livingsites.app \
  --website-id web_example_id \
  --deployment-host living-cms.netlify.app
```

The check failed closed unless all of these conditions were true:

- both hostnames were syntactically valid;
- the fallback hostname resolved in DNS;
- its CNAME or resolved addresses pointed to the configured Netlify deployment hostname;
- HTTPS reached Netlify successfully;
- the public response contained the expected renderer Website marker.

The command did not require a CMS session, read credentials, modify DNS, provision domains, or mutate application data.
