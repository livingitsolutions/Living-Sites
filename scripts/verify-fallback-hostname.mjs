import { resolve4, resolve6, resolveCname } from "node:dns/promises";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1]);
const hostname = args.get("--hostname");
const websiteId = args.get("--website-id");
const deploymentHost = args.get("--deployment-host");

if (!hostname || !websiteId || !deploymentHost) {
  console.error("Usage: npm run fallback:verify -- --hostname <fallback-host> --website-id <website-id> --deployment-host <site.netlify.app>");
  process.exit(2);
}

const hostnamePattern = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const normalize = (value) => value.trim().toLowerCase().replace(/\.$/, "");
const normalizedHostname = normalize(hostname);
const normalizedDeploymentHost = normalize(deploymentHost);
if (!hostnamePattern.test(normalizedHostname) || !hostnamePattern.test(normalizedDeploymentHost)) {
  console.error("Fallback hostname or deployment hostname is not syntactically valid.");
  process.exit(1);
}

async function addresses(host) {
  const [ipv4, ipv6] = await Promise.all([resolve4(host).catch(() => []), resolve6(host).catch(() => [])]);
  return [...ipv4, ...ipv6];
}

const [fallbackAddresses, deploymentAddresses, aliases] = await Promise.all([
  addresses(normalizedHostname),
  addresses(normalizedDeploymentHost),
  resolveCname(normalizedHostname).catch(() => []),
]);

if (!fallbackAddresses.length) {
  console.error(`DNS did not resolve ${normalizedHostname}.`);
  process.exit(1);
}

const pointsToDeployment = aliases.map(normalize).includes(normalizedDeploymentHost)
  || fallbackAddresses.some((address) => deploymentAddresses.includes(address));
if (!pointsToDeployment) {
  console.error(`${normalizedHostname} resolves, but DNS does not point to ${normalizedDeploymentHost}.`);
  process.exit(1);
}

const response = await fetch(`https://${normalizedHostname}/`, { redirect: "follow", signal: AbortSignal.timeout(15000) });
const body = await response.text();
const reachesNetlify = response.headers.get("server")?.toLowerCase().includes("netlify") || response.headers.has("x-nf-request-id");
if (!reachesNetlify) {
  console.error("The fallback hostname resolved but did not reach Netlify.");
  process.exit(1);
}
if (!response.ok) {
  console.error(`The fallback hostname reached Netlify but returned HTTP ${response.status}.`);
  process.exit(1);
}
const marker = `data-website="${websiteId}"`;
if (!body.includes(marker)) {
  console.error("The public renderer did not select the expected Website.");
  process.exit(1);
}

console.log(JSON.stringify({ hostname: normalizedHostname, deploymentHost: normalizedDeploymentHost, websiteId, dnsResolved: true, reachesConfiguredDeployment: true, publicResolverSelectedWebsite: true }, null, 2));
