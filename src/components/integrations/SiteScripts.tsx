import { isAdsConfigured } from "@/lib/ads";
import { AdsScript } from "./AdsScript";
import { CmpScript } from "./CmpScript";

// The app bundle contains no analytics of its own: the cookieless page beacon on
// enginecv.app is injected by Cloudflare's edge (see /privacy section 2). The only
// third-party script here is AdSense: it exists only in deployments that configure
// ads, and loads only after ad consent.
export function SiteScripts() {
    return isAdsConfigured() ? <><CmpScript /><AdsScript /></> : null;
}
