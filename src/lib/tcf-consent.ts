// The certified CMP owns the TC string and its TCF version. This adapter reads
// its live API; the old local preference alone must never authorize Google ads.
export const CMP_READY_EVENT = "enginecv:cmp-ready";

export type TcfData = {
    cmpId?: number;
    cmpStatus?: string;
    eventStatus?: string;
    gdprApplies?: boolean;
    listenerId?: number;
    tcString?: string;
    purpose?: { consents?: Record<number, boolean>; legitimateInterests?: Record<number, boolean> };
    vendor?: { consents?: Record<number, boolean>; legitimateInterests?: Record<number, boolean> };
};

export type TcfApi = (
    command: "addEventListener" | "removeEventListener",
    version: 2,
    callback: (data: TcfData, success: boolean) => void,
    listenerId?: number,
) => void;

declare global {
    interface Window {
        __tcfapi?: TcfApi;
    }
}

export function hasTcfAdConsent(data: TcfData | null, success: boolean): boolean {
    if (!success || !data || !(Number(data.cmpId) > 0) || data.cmpStatus === "error") return false;
    // Outside the CMP's GDPR scope, the separate local opt-in still applies.
    if (data.gdprApplies === false) return true;
    return data.gdprApplies === true
        && data.cmpStatus === "loaded"
        && (data.eventStatus === "tcloaded" || data.eventStatus === "useractioncomplete")
        && Boolean(data.tcString)
        && data.purpose?.consents?.[1] === true
        && (data.purpose?.consents?.[2] === true
            || (data.purpose?.legitimateInterests?.[2] === true && data.vendor?.legitimateInterests?.[755] === true))
        && data.vendor?.consents?.[755] === true;
}

export function subscribeTcfConsent(onChange: (allowed: boolean) => void): () => void {
    let active = true;
    let api: TcfApi | undefined;
    let listenerId: number | undefined;
    const connect = () => {
        if (api || !window.__tcfapi) return;
        api = window.__tcfapi;
        try {
            api("addEventListener", 2, (data, success) => {
                if (data?.listenerId !== undefined) listenerId = data.listenerId;
                if (!active) {
                    if (listenerId !== undefined) api?.("removeEventListener", 2, () => undefined, listenerId);
                    return;
                }
                // Opening preferences is not a new choice. Keep the last
                // decision until the CMP reports completion or an error.
                if (success && data?.eventStatus === "cmpuishown") return;
                onChange(hasTcfAdConsent(data, success));
            });
        } catch {
            onChange(false);
            api = undefined;
        }
    };
    window.addEventListener(CMP_READY_EVENT, connect);
    connect();
    return () => {
        active = false;
        window.removeEventListener(CMP_READY_EVENT, connect);
        if (listenerId !== undefined) api?.("removeEventListener", 2, () => undefined, listenerId);
    };
}
