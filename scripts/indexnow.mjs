// Tell Bing, Yandex and other IndexNow engines which URLs changed.
// Usage: node scripts/indexnow.mjs [--dry]   (reads the live sitemap)
// The key is public by design: IndexNow verifies it by fetching
// https://enginecv.app/<key>.txt, so it must be deployed before submitting.
const HOST = "enginecv.app";
const KEY = "7d92baa1915b29cd34e31d4254021d70";
const dry = process.argv.includes("--dry");

const sitemap = await (await fetch(`https://${HOST}/sitemap.xml`)).text();
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const keyCheck = await fetch(`https://${HOST}/${KEY}.txt`);
if (!keyCheck.ok || (await keyCheck.text()).trim() !== KEY) {
    console.error("Key file is not live yet. Deploy first.");
    process.exit(1);
}
console.log(`${urlList.length} URLs from sitemap`);
if (dry) process.exit(0);

const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList }),
});
console.log(res.status, res.statusText); // 200/202 = accepted
