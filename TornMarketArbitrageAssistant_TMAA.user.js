// ==UserScript==
// @name         Torn Market Arbitrage Assistant (TMAA)
// @namespace    https://github.com/ShavedW00kie/
// @version      1.0.1
// @description  Find item-market price gaps and fee-adjusted resale opportunities, plan quantities within a budget, and scan a watchlist.
// @author       ShavedW00kie (Torn: ThaWookie [2954173] )
// @match        https://www.torn.com/page.php*
// @match        https://torn.com/page.php*
// @homepageURL  https://github.com/ShavedW00kie
// @grant        GM_info
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM.info
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.xmlHttpRequest
// @grant        GM.setClipboard
// @connect      api.torn.com
// @license      BSD-3-Clause
// @run-at       document-end
// @noframes
// ==/UserScript==

/*
 * Copyright (c) 2026 ShavedW00kie. All rights reserved.
 * Includes Donation UI Module 1.4 and Modular Userscript Debugger 1.0.2,
 * adapted for TMAA 1.0.1. All three components use BSD-3-Clause:
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 * 1. Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 * 3. Neither the name of the copyright holder nor the names of its contributors
 *    may be used to endorse or promote products derived from this software
 *    without specific prior written permission.
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

(function (GM_info) {
    "use strict";
    if (window.top !== window.self || document.documentElement.hasAttribute("data-tmaa-active")) return;
    document.documentElement.setAttribute("data-tmaa-active", "1.0.1");
    const MyDebug = initializeModularDebugger(GM_info.script.name);
    const VERSION = "1.0.1",
        PREFIX = "tmaa2_",
        MAX_MONEY = 100000000000;
    const DEFAULTS = Object.freeze({
        mode: "gap",
        venue: "market",
        sell: 0,
        qty: 1000,
        budget: 10000000,
        baseFee: 5,
        anonymous: false,
        anonFee: 10,
        reserve: 0,
        minProfit: 1,
        minROI: 1,
        haircut: 2,
        undercut: 1,
        capAverage: true,
        highlight: true,
        pages: 3,
        staleSeconds: 120
    });
    const state = {
        prefs: { ...DEFAULTS },
        targets: {},
        drafts: {},
        watch: [],
        catalog: {},
        catalogAt: 0,
        key: "",
        keyStored: false,
        halted: "",
        selected: 0,
        books: new Map(),
        watchResults: new Map(),
        ui: null,
        support: null,
        observer: null,
        scheduled: false,
        busy: false,
        scanAbort: null,
        staleTimer: 0,
        lastRoute: "",
        autoAttempt: new Set(),
        marked: new Set(),
        storageWarning: "",
        status: "Select an item or scan your watchlist.",
        storeTail: Promise.resolve()
    };
    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
    const positiveInt = (n) => typeof n === "number" && Number.isSafeInteger(n) && n > 0;
    const money = (n) =>
        Number.isFinite(n)
            ? (n < 0 ? "−$" : "$") + Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })
            : "—";
    const num = (n) => (Number.isFinite(n) ? n.toLocaleString("en-US") : "—");
    const bps = (n) => Math.round(n * 100);
    const fee = (price, percent) => Math.ceil((price * bps(percent)) / 10000);
    const isMarket = () => new URL(location.href).searchParams.get("sid") === "ItemMarket";
    const abortError = () => new DOMException("Stopped", "AbortError");
    function checkAbort(signal) {
        if (signal && signal.aborted) throw abortError();
    }
    function log(event, details = {}, level = "INFO") {
        MyDebug.log({ event, ...details }, level);
    }
    function text(node, value) {
        if (node && node.textContent !== String(value)) node.textContent = String(value);
    }
    function element(tag, content, className) {
        const e = document.createElement(tag);
        if (content !== undefined) e.textContent = String(content);
        if (className) e.className = className;
        return e;
    }
    function link(label, href) {
        const a = element("a", label);
        a.href = href;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        return a;
    }
    function button(label, handler) {
        const b = element("button", label);
        b.type = "button";
        b.addEventListener("click", handler);
        return b;
    }
    function notice(message, level = "INFO") {
        state.status = message;
        text($("#tmaa-status"), message);
        log("status", { message }, level);
    }

    // General data may fall back to localStorage. Keys never fall back to page storage.
    async function readStore(name, fallback, secret = false) {
        try {
            if (typeof GM_getValue === "function") return await GM_getValue(name, fallback);
            if (typeof GM !== "undefined" && typeof GM.getValue === "function")
                return await GM.getValue(name, fallback);
        } catch (_) {
            log("storage-read-unavailable", { secret }, "WARN");
        }
        if (!secret) {
            try {
                const s = localStorage.getItem(name);
                return s === null ? fallback : JSON.parse(s);
            } catch (_) {}
        }
        return fallback;
    }
    async function writeStore(name, value, secret = false) {
        try {
            if (typeof GM_setValue === "function") {
                await GM_setValue(name, value);
                return true;
            }
            if (typeof GM !== "undefined" && typeof GM.setValue === "function") {
                await GM.setValue(name, value);
                return true;
            }
        } catch (_) {
            log("storage-write-unavailable", { secret }, "WARN");
        }
        if (!secret) {
            try {
                localStorage.setItem(name, JSON.stringify(value));
                return true;
            } catch (_) {}
        }
        return false;
    }
    function saveConfig() {
        const data = JSON.parse(JSON.stringify({ prefs: state.prefs, targets: state.targets, watch: state.watch }));
        state.storeTail = state.storeTail.then(async () => {
            if (!(await writeStore(PREFIX + "config", data))) {
                state.storageWarning = "Settings could not be saved; they last only for this page.";
                notice(state.storageWarning, "WARN");
            }
        });
    }
    function validatePrefs(raw = {}) {
        const p = { ...DEFAULTS };
        for (const k of ["capAverage", "highlight", "anonymous"]) if (typeof raw[k] === "boolean") p[k] = raw[k];
        for (const [k, values] of Object.entries({
            mode: ["gap", "manual", "average", "npc"],
            venue: ["market", "bazaar", "trade"]
        })) {
            if (values.includes(raw[k])) p[k] = raw[k];
        }
        const bounds = {
            sell: [0, MAX_MONEY],
            qty: [1, 1000000],
            budget: [0, MAX_MONEY],
            baseFee: [0, 50],
            anonFee: [0, 50],
            reserve: [0, 50],
            minProfit: [0, MAX_MONEY],
            minROI: [0, 10000],
            haircut: [0, 90],
            undercut: [0, MAX_MONEY],
            pages: [1, 5],
            staleSeconds: [30, 600]
        };
        for (const [k, [lo, hi]] of Object.entries(bounds)) {
            const v = Number(raw[k]);
            if (raw[k] !== undefined && Number.isFinite(v) && v >= lo && v <= hi) {
                p[k] = ["baseFee", "anonFee", "reserve", "minROI", "haircut"].includes(k)
                    ? Math.round(v * 100) / 100
                    : Math.floor(v);
            }
        }
        return p;
    }
    function prefsFor(id) {
        return validatePrefs({ ...state.prefs, ...(state.targets[id] || {}), ...(state.drafts[id] || {}) });
    }

    // Timers below schedule API pacing, request deadlines and quote expiration,
    // never element discovery. All element discovery is event/observer driven.
    function pause(ms, signal) {
        return new Promise((resolve, reject) => {
            checkAbort(signal);
            const id = setTimeout(done, ms);
            function done() {
                if (signal) signal.removeEventListener("abort", stop);
                resolve();
            }
            function stop() {
                clearTimeout(id);
                if (signal) signal.removeEventListener("abort", stop);
                reject(abortError());
            }
            if (signal) signal.addEventListener("abort", stop, { once: true });
        });
    }
    const gate = {
        tail: Promise.resolve(),
        memory: { calls: [], blockedUntil: 0 },
        tab: Math.random().toString(36).slice(2)
    };
    function releaseLease() {
        try {
            const owner = JSON.parse(localStorage.getItem(PREFIX + "owner") || "null");
            if (owner?.tab === gate.tab) localStorage.removeItem(PREFIX + "owner");
        } catch (_) {}
    }
    function ledger() {
        try {
            const x = JSON.parse(localStorage.getItem(PREFIX + "rate") || "null");
            if (x && Array.isArray(x.calls)) return x;
        } catch (_) {}
        return gate.memory;
    }
    function putLedger(x) {
        gate.memory = x;
        try {
            localStorage.setItem(PREFIX + "rate", JSON.stringify(x));
        } catch (_) {}
    }
    async function sharedGate(task, signal) {
        if (navigator.locks && typeof navigator.locks.request === "function") {
            return navigator.locks.request(PREFIX + "api", { mode: "exclusive", signal }, task);
        }
        // Older WebViews: keep a single API owner with a short lease. Do not
        // start a second scanner when another tab owns that lease.
        let shared = true;
        try {
            const prior = JSON.parse(localStorage.getItem(PREFIX + "owner") || "null");
            if (prior && prior.until > Date.now() && prior.tab !== gate.tab)
                throw new Error("TMAA is using the API in another tab. Use one active scanner.");
            localStorage.setItem(PREFIX + "owner", JSON.stringify({ tab: gate.tab, until: Date.now() + 90000 }));
        } catch (e) {
            if (e.message.includes("another tab")) throw e;
            shared = false;
        }
        if (shared) {
            await pause(75, signal);
            const owner = JSON.parse(localStorage.getItem(PREFIX + "owner") || "null");
            if (!owner || owner.tab !== gate.tab)
                throw new Error("Another TMAA tab acquired API access. Use one active scanner.");
        }
        return task();
    }
    async function reserveSlot(signal) {
        checkAbort(signal);
        for (;;) {
            const now = Date.now(),
                x = ledger();
            x.calls = x.calls.filter((t) => Number.isFinite(t) && t > now - 60000 && t <= now + 60000);
            const wait = Math.max(
                0,
                (x.blockedUntil || 0) - now,
                (x.calls[x.calls.length - 1] || 0) + 4100 - now,
                x.calls.length >= 15 ? x.calls[0] + 60020 - now : 0
            );
            if (wait <= 0) {
                x.calls.push(now);
                putLedger(x);
                return;
            }
            if (wait > 61000) throw new Error("API cooldown active. Try again later.");
            await pause(wait, signal);
            checkAbort(signal);
        }
    }
    function cooldown(ms) {
        const x = ledger();
        x.blockedUntil = Math.max(x.blockedUntil || 0, Date.now() + ms);
        putLedger(x);
    }
    function transport(url, key, signal) {
        return new Promise((resolve, reject) => {
            checkAbort(signal);
            let settled = false,
                handle = null;
            const controller = new AbortController();
            function finish(error, result) {
                if (settled) return;
                settled = true;
                clearTimeout(deadline);
                if (signal) signal.removeEventListener("abort", stop);
                error ? reject(error) : resolve(result);
            }
            function stop() {
                finish(abortError());
                controller.abort();
                try {
                    if (handle && handle.abort) handle.abort();
                } catch (_) {}
            }
            const deadline = setTimeout(() => {
                finish(new Error("API request timed out."));
                controller.abort();
                try {
                    if (handle && handle.abort) handle.abort();
                } catch (_) {}
            }, 20000);
            if (signal) signal.addEventListener("abort", stop, { once: true });
            const headers = { Accept: "application/json", Authorization: "ApiKey " + key };
            const options = {
                method: "GET",
                url,
                headers,
                timeout: 20000,
                anonymous: true,
                onload: (r) => finish(null, { status: r.status, body: r.responseText }),
                onerror: () => finish(new Error("API network request failed.")),
                ontimeout: () => finish(new Error("API request timed out.")),
                onabort: () => finish(abortError())
            };
            try {
                const request =
                    typeof GM_xmlhttpRequest === "function"
                        ? GM_xmlhttpRequest
                        : typeof GM !== "undefined" && typeof GM.xmlHttpRequest === "function"
                          ? GM.xmlHttpRequest.bind(GM)
                          : null;
                if (request) {
                    handle = request(options);
                    if (handle && typeof handle.then === "function")
                        handle.then((r) => {
                            if (r && r.status !== undefined) options.onload(r);
                        }, options.onerror);
                } else {
                    fetch(url, {
                        headers,
                        signal: controller.signal,
                        credentials: "omit",
                        referrerPolicy: "no-referrer"
                    })
                        .then(async (r) => finish(null, { status: r.status, body: await r.text() }))
                        .catch(() => finish(new Error("API connection failed. Check TornPDA network access.")));
                }
            } catch (_) {
                finish(new Error("The userscript manager could not start the API request."));
            }
        });
    }
    async function api(path, params = {}, signal) {
        if (!/^\/(?:torn\/items|market\/[1-9]\d*\/itemmarket)$/.test(path))
            throw new Error("Unsupported API endpoint.");
        const job = async () => {
            checkAbort(signal);
            if (state.halted) throw new Error(state.halted);
            const key = state.key;
            if (!/^[a-zA-Z0-9]{16}$/.test(key)) throw new Error("Add a 16-character Public API key in Settings.");
            for (let attempt = 0; attempt < 3; attempt++) {
                const response = await sharedGate(async () => {
                    await reserveSlot(signal);
                    checkAbort(signal);
                    if (key !== state.key) throw abortError();
                    const url = new URL("https://api.torn.com/v2" + path);
                    for (const [k, v] of Object.entries({ ...params, comment: "TMAA" }))
                        url.searchParams.set(k, String(v));
                    log("api-request", { path, attempt: attempt + 1 });
                    return transport(url.href, key, signal);
                }, signal);
                checkAbort(signal);
                if (key !== state.key) throw abortError();
                if (response.status === 429) {
                    cooldown(60000);
                    throw new Error("Torn rate limit reached. API paused for 60 seconds.");
                }
                if (!Number.isInteger(response.status) || response.status <= 0)
                    throw new Error("Torn API returned no valid HTTP status.");
                if (response.status >= 500 && attempt < 2) {
                    await pause(2000 * (attempt + 1), signal);
                    continue;
                }
                if (response.status < 200 || response.status >= 300)
                    throw new Error("Torn API HTTP " + response.status + ".");
                let data;
                try {
                    data = typeof response.body === "string" ? JSON.parse(response.body) : response.body;
                } catch (_) {
                    throw new Error("Torn returned invalid JSON.");
                }
                if (!data || typeof data !== "object") throw new Error("Empty API response.");
                if (data.error) {
                    const code = Number(data.error.code);
                    log("api-error", { path, code }, "WARN");
                    if (code === 5 || code === 8) {
                        cooldown(60000);
                        throw new Error("Torn API code " + code + ": requests paused for 60 seconds.");
                    }
                    if ([1, 2, 10, 13, 14, 16, 18].includes(code)) {
                        state.halted =
                            "API stopped (code " + code + "). Check key permissions/status, then save the key again.";
                        throw new Error(state.halted);
                    }
                    if ([0, 9, 12, 15, 17, 24].includes(code) && attempt < 2) {
                        await pause(2000 * (attempt + 1), signal);
                        continue;
                    }
                    throw new Error("Torn API error " + code + ". Check the debugger and API settings.");
                }
                log("api-response", { path, status: response.status });
                return data;
            }
            throw new Error("Torn API is temporarily unavailable.");
        };
        const result = gate.tail.then(job, job);
        gate.tail = result.catch(() => {});
        return result;
    }

    function normalizeCatalog(data) {
        if (!data || !Array.isArray(data.items)) throw new Error("Unexpected torn/items schema.");
        const out = {};
        for (const x of data.items) {
            if (!positiveInt(x.id) || typeof x.name !== "string" || !x.value) continue;
            const shops = Array.isArray(x.value.shops)
                ? x.value.shops.filter((s) => s.country === "Torn" && positiveInt(s.sell_price))
                : [];
            out[x.id] = {
                id: x.id,
                name: x.name,
                type: x.type,
                tradable: x.is_tradable === true,
                average: positiveInt(x.value.market_price) ? x.value.market_price : 0,
                npc: shops.length ? Math.max(...shops.map((s) => s.sell_price)) : 0,
                shop: shops.map((s) => s.shop).join(", ")
            };
        }
        if (!Object.keys(out).length) throw new Error("Item catalog contains no usable records.");
        return out;
    }
    function validCatalogCache(value) {
        return (
            value &&
            typeof value === "object" &&
            Object.entries(value).every(
                ([id, x]) =>
                    x &&
                    positiveInt(x.id) &&
                    String(x.id) === id &&
                    typeof x.name === "string" &&
                    typeof x.type === "string" &&
                    typeof x.tradable === "boolean" &&
                    Number.isSafeInteger(x.average) &&
                    x.average >= 0 &&
                    Number.isSafeInteger(x.npc) &&
                    x.npc >= 0 &&
                    typeof x.shop === "string"
            )
        );
    }
    async function catalog(signal) {
        if (Object.keys(state.catalog).length && Date.now() - state.catalogAt < 86400000) return;
        state.catalog = normalizeCatalog(await api("/torn/items", {}, signal));
        state.catalogAt = Date.now();
        await writeStore(PREFIX + "catalog", { at: state.catalogAt, items: state.catalog });
        populateCatalog();
        log("catalog-loaded", { count: Object.keys(state.catalog).length });
    }
    function normalizeMarket(data, id) {
        const m = data && data.itemmarket;
        if (!m || !Array.isArray(m.listings)) throw new Error("Unexpected market/itemmarket schema.");
        if (!m.item && m.listings.length === 0)
            return {
                item: { id, name: state.catalog[id]?.name || "Item " + id, type: "", average: 0 },
                listings: [],
                sourceAt: Date.now(),
                delay: 30000,
                next: null
            };
        if (!m.item || m.item.id !== id) throw new Error("API item ID mismatch; quote discarded.");
        const listings = m.listings.map((x) => {
            if (!positiveInt(x.price) || x.price > MAX_MONEY || !positiveInt(x.amount))
                throw new Error("Invalid price or quantity; quote discarded.");
            return { price: x.price, amount: x.amount, details: x.item_details || null };
        });
        if (listings.length && !positiveInt(m.cache_timestamp))
            throw new Error("API quote has no valid cache timestamp; freshness cannot be verified.");
        const sourceAt = positiveInt(m.cache_timestamp) ? m.cache_timestamp * 1000 : Date.now();
        if (sourceAt > Date.now() + 60000) throw new Error("Invalid API cache timestamp.");
        return {
            item: {
                id,
                name: String(m.item.name || "Item " + id),
                type: String(m.item.type || ""),
                average: positiveInt(m.item.average_price) ? m.item.average_price : 0
            },
            listings,
            sourceAt,
            delay: Math.max(30000, Math.min(600000, (Number(m.cache_delay) || 30) * 1000)),
            next: data._metadata?.links?.next || data._metadata?.next || null
        };
    }
    async function book(id, signal) {
        const old = state.books.get(id);
        if (old && Date.now() < old.expires && !old.error) return old;
        const pages = state.prefs.pages;
        let all = [],
            first = null,
            offset = 0,
            partial = false,
            priorSignature = "";
        for (let page = 0; page < pages; page++) {
            const raw = await api("/market/" + id + "/itemmarket", { limit: 100, offset }, signal);
            const part = normalizeMarket(raw, id);
            if (!first) first = part;
            // Never merge pages from different global snapshots.
            if (page && part.sourceAt !== first.sourceAt) {
                partial = true;
                break;
            }
            const signature = JSON.stringify(part.listings);
            if (page && signature === priorSignature) {
                partial = true;
                break;
            }
            priorSignature = signature;
            all.push(...part.listings);
            if (!part.next) {
                partial = part.listings.length === 100 && !raw._metadata?.links;
                break;
            }
            if (page === pages - 1) {
                partial = true;
                break;
            }
            // Rebuild the fixed endpoint; never follow API-supplied URLs or keys.
            let next;
            try {
                next = new URL(part.next, "https://api.torn.com");
            } catch (_) {
                partial = true;
                break;
            }
            const nextOffset = Number(next.searchParams.get("offset"));
            if (next.origin !== "https://api.torn.com" || !Number.isSafeInteger(nextOffset) || nextOffset <= offset) {
                partial = true;
                break;
            }
            offset = nextOffset;
        }
        const result = {
            ...first,
            listings: all.sort((a, b) => a.price - b.price),
            partial,
            retrievedAt: Date.now(),
            expires: Math.max(Date.now() + 30000, first.sourceAt + first.delay),
            error: ""
        };
        state.books.set(id, result);
        return result;
    }
    function isStale(b, p = state.prefs) {
        return !b || !!b.error || Date.now() - b.sourceAt > p.staleSeconds * 1000;
    }
    function isEquipment(b) {
        return (
            /weapon|armor|armour|primary|secondary|melee|defensive/i.test(b.item.type) ||
            b.listings.some((x) => x.details)
        );
    }
    function netUnit(sell, p) {
        if (!positiveInt(sell) || sell > MAX_MONEY) return null;
        const taxable = p.venue === "market" && p.mode !== "npc";
        const tax = taxable ? fee(sell, p.baseFee) : 0,
            anon = taxable && p.anonymous ? fee(sell, p.anonFee) : 0;
        const reserve = fee(sell, p.reserve);
        return { gross: sell, tax: tax + anon, reserve, net: sell - tax - anon - reserve };
    }
    function maxBuy(sell, p) {
        const n = netUnit(sell, p);
        if (!n || n.net <= 0) return 0;
        return Math.max(0, Math.min(n.net - Math.max(1, p.minProfit), Math.floor(n.net / (1 + p.minROI / 100))));
    }
    function passes(price, net, p) {
        const profit = net - price;
        return profit >= Math.max(1, p.minProfit) && (profit / price) * 100 + 1e-9 >= p.minROI;
    }
    function tiers(listings) {
        const t = [];
        for (const x of listings) {
            const prior = t[t.length - 1];
            if (prior && prior.price === x.price) prior.amount += x.amount;
            else t.push({ price: x.price, amount: x.amount });
        }
        return t;
    }
    function makePlan(rows, sell, p, mustClear = false) {
        const unit = netUnit(sell, p);
        if (!unit || unit.net <= 0) return null;
        let funds = p.budget || Number.MAX_SAFE_INTEGER,
            left = p.qty,
            cost = 0,
            quantity = 0;
        const chosen = [];
        for (const row of rows) {
            const take = Math.min(row.amount, left, Math.floor(funds / row.price));
            if (mustClear && (take !== row.amount || !passes(row.price, unit.net, p))) return null;
            if (!passes(row.price, unit.net, p) || take <= 0) continue;
            const expense = take * row.price;
            if (!Number.isSafeInteger(expense + cost) || !Number.isSafeInteger((quantity + take) * sell)) return null;
            chosen.push({ ...row, take, profit: unit.net - row.price });
            cost += expense;
            quantity += take;
            funds -= expense;
            left -= take;
        }
        if (!quantity) return null;
        const gross = quantity * sell,
            tax = quantity * unit.tax,
            reserve = quantity * unit.reserve;
        const profit = quantity * unit.net - cost;
        return {
            rows: chosen,
            quantity,
            cost,
            gross,
            tax,
            reserve,
            profit,
            roi: (profit / cost) * 100,
            sell,
            ceiling: maxBuy(sell, p)
        };
    }
    function analyze(b, p, info = {}) {
        if (!b || b.error)
            return { reason: b?.error || "Scan this item to load market listings.", plan: null, sell: 0 };
        if (isStale(b, p)) return { reason: "Quote expired. Refresh before using these prices.", plan: null, sell: 0 };
        if (isEquipment(b))
            return {
                reason: "Equipment varies by quality/bonuses. Automatic arbitrage is disabled; inspect individual items in Torn.",
                plan: null,
                sell: 0
            };
        if (!b.listings.length) return { reason: "No listings returned for this item.", plan: null, sell: 0 };
        const rows = tiers(b.listings),
            average = b.item.average;
        if (p.mode === "gap") {
            if (p.capAverage && !average)
                return {
                    reason: "No market-value cap is available. Set a manual resale price to assess this item.",
                    plan: null,
                    sell: 0
                };
            let best = null;
            for (let i = 1; i < rows.length; i++) {
                const benchmark = p.capAverage ? Math.min(rows[i].price, average) : rows[i].price;
                const sell = Math.floor(Math.max(0, benchmark - p.undercut) * (1 - p.haircut / 100));
                // Every cheaper tier must be affordable and profitable. Buying
                // only part of a tier cannot create the advertised price gap.
                if (sell >= rows[i].price || sell <= rows[i - 1].price) continue;
                const candidate = makePlan(rows.slice(0, i), sell, p, true);
                if (candidate && (!best || candidate.profit > best.profit))
                    best = { ...candidate, benchmark: rows[i].price };
            }
            return {
                plan: best,
                sell: best?.sell || 0,
                reason: best
                    ? "Price-gap estimate: requires buying ALL listed lower tiers in this plan. Resale depends on future buyers."
                    : "No complete profitable price gap fits your budget, quantity and minimum-profit settings."
            };
        }
        const sell =
            p.mode === "manual"
                ? p.sell
                : p.mode === "npc"
                  ? info.npc || 0
                  : Math.floor(average * (1 - p.haircut / 100));
        const reason =
            p.mode === "manual"
                ? "Your resale target; confirm your buyer and price before buying."
                : p.mode === "npc"
                  ? "Torn shop sell-back reference: " +
                    (info.shop || "unavailable") +
                    ". Verify shop eligibility in game."
                  : "Market-value estimate; an average price is not a buyer's offer.";
        return {
            plan: makePlan(rows, sell, p),
            sell,
            reason: sell ? reason : "No resale price is available. Enter a manual price or choose another strategy."
        };
    }

    // Only explicit item IDs, current hash routes and item images identify rows.
    function routeItem() {
        const hash = new URLSearchParams(location.hash.replace(/^#\/?/, ""));
        const query = new URL(location.href).searchParams;
        return Number(hash.get("itemID") || hash.get("itemId") || query.get("itemID")) || 0;
    }
    function marketLink(id) {
        const item = state.catalog[id] || state.books.get(id)?.item || { name: "Item " + id, type: "" };
        const params = new URLSearchParams({ itemID: String(id), itemName: item.name, itemType: item.type || "" });
        return "https://www.torn.com/page.php?sid=ItemMarket#/market/view=search&" + params.toString();
    }
    function rowItem(row) {
        const raw = row.getAttribute("data-item-id") || row.getAttribute("data-itemid");
        if (raw && /^\d+$/.test(raw)) return Number(raw);
        const image = $("img[src*='/images/items/']", row),
            match = image?.getAttribute("src")?.match(/\/images\/items\/(\d+)\//);
        return match ? Number(match[1]) : 0;
    }
    function parseMoney(value) {
        const s = String(value || "")
            .replace(/\u00a0/g, " ")
            .trim();
        if (!/^\$?\s*(?:\d{1,3}(?:,\d{3})+|\d+)$/.test(s)) return null;
        const n = Number(s.replace(/[$,\s]/g, ""));
        return positiveInt(n) && n <= MAX_MONEY ? n : null;
    }
    function clearHighlights() {
        for (const row of state.marked) {
            row.classList.remove("tmaa-profit-row");
            row.removeAttribute("data-tmaa-profit");
        }
        state.marked.clear();
    }
    function highlight() {
        const root = $("#item-market-root"),
            keep = new Set();
        if (!root || !state.prefs.highlight || !isMarket() || !state.key || state.halted) {
            clearHighlights();
            return;
        }
        const sellerLists = $$("[class*='sellerList___']", root),
            route = routeItem();
        for (const list of sellerLists) {
            const parentItem = list.closest("[class*='itemList___'] > li");
            const id = parentItem ? rowItem(parentItem) : sellerLists.length === 1 ? route : 0;
            if (!id) continue;
            const p = prefsFor(id),
                b = state.books.get(id),
                analysis = analyze(b, p, state.catalog[id]);
            if (!analysis.plan) continue;
            for (const row of Array.from(list.children)) {
                if (!(row instanceof HTMLElement) || row.offsetParent === null) continue;
                const price = parseMoney($("[class*='price__']", row)?.textContent);
                const deal = analysis.plan.rows.find((x) => x.price === price);
                if (!deal) continue;
                keep.add(row);
                row.classList.add("tmaa-profit-row");
                const label = "TMAA est. +" + money(deal.profit) + "/unit";
                if (row.getAttribute("data-tmaa-profit") !== label) row.setAttribute("data-tmaa-profit", label);
            }
        }
        for (const row of state.marked)
            if (!keep.has(row)) {
                row.classList.remove("tmaa-profit-row");
                row.removeAttribute("data-tmaa-profit");
            }
        state.marked = keep;
    }

    function injectStyle() {
        if ($("#tmaa-style")) return;
        const s = element("style");
        s.id = "tmaa-style";
        s.textContent = `
        #tmaa-dashboard{color:#e8edf4;background:#171c24;border:1px solid #414a59;border-top:3px solid #ecc022;border-radius:8px;margin:12px 0;padding:14px;font:13px/1.5 system-ui,Arial,sans-serif;box-sizing:border-box;clear:both}
        #tmaa-dashboard *{box-sizing:border-box}#tmaa-dashboard h2{font-size:18px;color:#fff;margin:0}#tmaa-dashboard p{margin:8px 0}#tmaa-dashboard small,.tmaa-muted{color:#adb8c8}
        #tmaa-dashboard .tmaa-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0}#tmaa-dashboard .tmaa-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:10px;margin:10px 0}
        #tmaa-dashboard label{display:flex;flex-direction:column;gap:4px;color:#dce4ef}#tmaa-dashboard label.tmaa-check{flex-direction:row;align-items:center}
        #tmaa-dashboard input,#tmaa-dashboard select,#tmaa-dashboard textarea{background:#242c38;color:#fff;border:1px solid #56647a;border-radius:4px;padding:8px;min-height:40px;font:inherit;max-width:100%;width:100%}
        #tmaa-dashboard input[type=checkbox]{width:18px;min-height:18px}#tmaa-dashboard button,#tmaa-dashboard a:not(.tw-support-btn){display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:7px 11px;border:1px solid #59677c;border-radius:5px;background:#2b3544;color:#fff;text-decoration:none;cursor:pointer;font:inherit;touch-action:manipulation}
        #tmaa-dashboard button:disabled{opacity:.45;cursor:default}#tmaa-dashboard :focus-visible{outline:2px solid #ecc022;outline-offset:2px}#tmaa-dashboard .tmaa-primary{background:#ecc022;color:#171c24;border-color:#ecc022;font-weight:700}
        #tmaa-dashboard details{border-top:1px solid #3f4957;margin-top:12px;padding-top:9px}#tmaa-dashboard summary{cursor:pointer;font-weight:600;min-height:36px;padding:5px 0}#tmaa-dashboard .tmaa-table-wrap{overflow:auto;max-height:380px}
        #tmaa-dashboard table{border-collapse:collapse;width:100%;white-space:nowrap;font-variant-numeric:tabular-nums}#tmaa-dashboard th,#tmaa-dashboard td{padding:8px;border-bottom:1px solid #3b4655;text-align:right}#tmaa-dashboard th:first-child,#tmaa-dashboard td:first-child{text-align:left}#tmaa-dashboard th{color:#c8d4e5;background:#222a36;position:sticky;top:0}
        #tmaa-dashboard .tmaa-good{color:#83e0a6}#tmaa-dashboard .tmaa-note{background:#222a36;border-left:3px solid #ecc022;padding:8px 10px}#tmaa-status{overflow-wrap:anywhere}#tmaa-dashboard [hidden]{display:none!important}
        #tmaa-dashboard #tmaa-support{position:static;inset:auto;z-index:auto;width:auto;display:flex;flex-direction:row;flex-wrap:wrap;align-items:center;gap:10px;margin:8px 0}#tmaa-dashboard #tmaa-support .tw-support-btn{width:auto;min-height:44px;flex:1 1 190px}
        .tmaa-profit-row{box-shadow:inset 4px 0 #32bd75!important;background-color:rgba(50,189,117,.12)!important}.tmaa-profit-row::after{content:attr(data-tmaa-profit);display:block;color:#128044;font-size:11px;font-weight:700;padding:3px 8px;pointer-events:none}
        @media(max-width:480px){#tmaa-dashboard{padding:10px}#tmaa-dashboard .tmaa-grid{grid-template-columns:1fr 1fr}#tmaa-dashboard .tmaa-bar>*{flex:1 1 auto}#tmaa-dashboard h2{font-size:16px}#tmaa-dashboard td,#tmaa-dashboard th{padding:6px}}
        `;
        (document.head || document.body).appendChild(s);
    }
    function field(name, label, type, choices) {
        const wrap = element("label", label),
            input = element(type === "select" ? "select" : "input");
        input.id = "tmaa-" + name;
        input.dataset.setting = name;
        if (type === "select")
            for (const [value, title] of choices) {
                const option = element("option", title);
                option.value = value;
                input.appendChild(option);
            }
        else {
            input.type = type;
            if (type === "number") {
                input.min = "0";
                input.step = ["baseFee", "anonFee", "reserve", "minROI", "haircut"].includes(name) ? "0.01" : "1";
                input.inputMode = "decimal";
            }
        }
        if (type === "checkbox") wrap.className = "tmaa-check";
        wrap.appendChild(input);
        return wrap;
    }
    function group(fields) {
        const d = element("div", undefined, "tmaa-grid");
        fields.forEach((f) => d.appendChild(field(...f)));
        return d;
    }
    function populateCatalog() {
        const list = $("#tmaa-item-list");
        if (!list) return;
        const nodes = Object.values(state.catalog)
            .filter((x) => x.tradable)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((x) => {
                const o = element("option");
                o.value = x.id + " — " + x.name;
                return o;
            });
        list.replaceChildren(...nodes);
    }
    function syncInputs() {
        const p = prefsFor(state.selected);
        for (const e of $$("[data-setting]", state.ui || document)) {
            const value = p[e.dataset.setting];
            if (e.type === "checkbox") e.checked = !!value;
            else e.value = String(value);
        }
        const sellInput = $("#tmaa-sell");
        if (sellInput) sellInput.disabled = p.mode !== "manual";
        const id = state.selected,
            item = state.catalog[id] || state.books.get(id)?.item;
        text($("#tmaa-current"), id ? (item?.name || "Item") + " [" + id + "]" : "No item selected");
        const input = $("#tmaa-item");
        if (input && document.activeElement !== input) input.value = id ? id + (item ? " — " + item.name : "") : "";
        text(
            $("#tmaa-key-status"),
            state.key
                ? state.keyStored
                    ? "Key saved in userscript-manager storage."
                    : "Key is in memory for this page only."
                : "No API key saved."
        );
    }
    function buildUI() {
        const d = element("section");
        d.id = "tmaa-dashboard";
        d.setAttribute("aria-label", "Torn Market Arbitrage Assistant");
        d.innerHTML = `<div class="tmaa-bar"><h2>Market Arbitrage Assistant</h2><small>v${VERSION}</small></div>
        <div class="tmaa-bar"><input id="tmaa-item" aria-label="Item name or ID" list="tmaa-item-list" placeholder="Item name or ID, e.g. 206" autocomplete="off"><datalist id="tmaa-item-list"></datalist><button type="button" id="tmaa-select">Select item</button><button type="button" id="tmaa-refresh" class="tmaa-primary">Refresh quotes</button><button type="button" id="tmaa-stop" disabled>Stop scan</button></div>
        <strong id="tmaa-current">No item selected</strong><div id="tmaa-main-fields"></div>
        <div class="tmaa-bar" id="tmaa-item-actions"></div><p id="tmaa-status" role="status" aria-live="polite"></p>
        <div id="tmaa-summary"></div><div id="tmaa-quotes"></div>
        <details id="tmaa-watch-details"><summary>Watchlist scanner</summary><p class="tmaa-muted">Each item gets its own plan and budget. Scan results are alternatives, not one combined shopping basket.</p><div class="tmaa-bar" id="tmaa-watch-actions"></div><div id="tmaa-watch-results"></div></details>
        <details id="tmaa-settings"><summary>Settings, API key &amp; support</summary><p>Use a Public key or a custom key allowing market → itemmarket and torn → items.</p><div class="tmaa-bar"><input id="tmaa-api-key" type="password" minlength="16" maxlength="16" autocomplete="off" spellcheck="false" aria-label="Torn API key" placeholder="16-character API key"><button type="button" id="tmaa-key-save">Save key</button><button type="button" id="tmaa-key-forget">Forget key</button></div><p id="tmaa-key-status"></p><div id="tmaa-settings-fields"></div><div class="tmaa-bar" id="tmaa-tools"></div><div id="tmaa-support-host"></div><p class="tmaa-muted">Xanax tips: open Items, find Xanax, choose Send, and enter ThaWookie [2954173].</p>
        <p class="tmaa-muted">Data use: settings, item targets and public item metadata stay on this device. A saved key uses userscript-manager storage; if unavailable, it stays in memory. Requests go only to api.torn.com. Keys and raw API responses are excluded from logs and exports. Nothing is sent to the author. Support links open only when tapped.</p></details>
        <details><summary>How the calculations work</summary><p>Price gap buys every cheaper tier in a feasible plan, then estimates a resale below the next tier. Market value uses Torn’s average with your safety discount. Manual price uses your buyer’s offer or your own target. NPC sell-back uses a Torn shop’s sell_price where available.</p><p>Net profit = resale revenue − sales fees − reserve − purchase cost. ROI = net profit ÷ purchase cost. Fees and reserves round up per unit to avoid optimistic estimates. A budget of 0 means no budget cap. Quantity caps the entire item plan. Your minimum profit and ROI apply to every purchased unit.</p><p>Quotes can be globally cached, listings can disappear, and resale needs a buyer. Partial depth is labelled. Equipment with varying stats is excluded from automatic plans. Use Open item market to check availability and buy in Torn.</p></details>`;
        $("#tmaa-main-fields", d).appendChild(
            group([
                [
                    "mode",
                    "Resale strategy",
                    "select",
                    [
                        ["gap", "Buy price gap"],
                        ["manual", "Manual resale price"],
                        ["average", "Market value estimate"],
                        ["npc", "NPC sell-back"]
                    ]
                ],
                [
                    "venue",
                    "Sell through",
                    "select",
                    [
                        ["market", "Item market"],
                        ["bazaar", "My bazaar (0% sales fee)"],
                        ["trade", "Agreed trade (0% sales fee)"]
                    ]
                ],
                ["sell", "Manual sell price / item ($)", "number"],
                ["qty", "Maximum total quantity", "number"],
                ["budget", "Budget / item ($; 0 = uncapped)", "number"]
            ])
        );
        $("#tmaa-settings-fields", d).appendChild(
            group([
                ["baseFee", "Market sales fee (%)", "number"],
                ["anonymous", "Sell anonymously", "checkbox"],
                ["anonFee", "Anonymous extra fee (%; perk = 0)", "number"],
                ["reserve", "Cost/risk reserve (%)", "number"],
                ["minProfit", "Minimum profit / unit ($)", "number"],
                ["minROI", "Minimum ROI (%)", "number"],
                ["haircut", "Estimate safety discount (%)", "number"],
                ["undercut", "Gap undercut ($)", "number"],
                ["capAverage", "Cap gap target at market value", "checkbox"],
                ["highlight", "Highlight matching seller rows", "checkbox"],
                ["pages", "Maximum pages / item (1–5)", "number"],
                ["staleSeconds", "Quote expires after seconds (30–600)", "number"]
            ])
        );
        $("#tmaa-item-actions", d).append(
            button("Save target for this item", saveTarget),
            button("Use global defaults", clearTarget),
            button("★ Add to watchlist", addWatch)
        );
        $("#tmaa-watch-actions", d).append(
            button("Scan watchlist", () => runScan([...state.watch])),
            button("Add visible category items", addVisible),
            button("Export scan CSV", exportCSV)
        );
        $("#tmaa-tools", d).append(
            button("Reload item catalog", () =>
                runTask(async (signal) => {
                    state.catalogAt = 0;
                    await catalog(signal);
                    notice("Item catalog updated.");
                })
            ),
            button("🪲", () => MyDebug.toggleView()),
            button("📋 Copy Logs to Clipboard", function () {
                MyDebug.copy(this);
            })
        );
        $("#tmaa-key-save", d).addEventListener("click", saveKey);
        $("#tmaa-key-forget", d).addEventListener("click", forgetKey);
        $("#tmaa-select", d).addEventListener("click", selectFromInput);
        $("#tmaa-item", d).addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                selectFromInput();
            }
        });
        $("#tmaa-refresh", d).addEventListener("click", () => runScan([state.selected]));
        $("#tmaa-stop", d).addEventListener("click", () => state.scanAbort?.abort());
        d.addEventListener("change", (e) => {
            const input = e.target,
                name = input.dataset.setting;
            if (!name) return;
            const raw =
                input.type === "checkbox"
                    ? input.checked
                    : input.tagName === "SELECT"
                      ? input.value
                      : Number(input.value);
            if (input.type === "number" && (input.value.trim() === "" || !Number.isFinite(raw))) {
                notice("Enter a valid number; your previous setting is unchanged.", "WARN");
                syncInputs();
                return;
            }
            const next = validatePrefs({ ...prefsFor(state.selected), [name]: raw });
            if (next[name] !== raw) {
                notice("That value is outside the supported range.", "WARN");
                syncInputs();
                return;
            }
            if (state.selected && ["mode", "venue", "sell"].includes(name)) {
                state.drafts[state.selected] = { ...(state.drafts[state.selected] || {}), [name]: raw };
            } else state.prefs[name] = next[name];
            saveConfig();
            syncInputs();
            render();
            highlight();
        });
        return d;
    }

    async function saveKey() {
        if (state.busy) {
            notice("Stop the scan before changing the API key.", "WARN");
            return;
        }
        const input = $("#tmaa-api-key"),
            key = input.value.trim();
        if (!/^[a-zA-Z0-9]{16}$/.test(key)) {
            notice("API keys must contain exactly 16 letters/digits.", "WARN");
            return;
        }
        state.key = key;
        input.value = "";
        state.halted = "";
        state.autoAttempt.clear();
        state.keyStored = await writeStore(PREFIX + "key", key, true);
        syncInputs();
        notice(
            state.keyStored
                ? "Key saved. Load the catalog or refresh an item to connect."
                : "Secure key storage unavailable. The key is active in memory for this page."
        );
        runTask(async (signal) => {
            await catalog(signal);
            if (state.selected) await scanOne(state.selected, signal);
        });
    }
    async function forgetKey() {
        state.scanAbort?.abort();
        state.key = "";
        state.keyStored = false;
        state.halted = "";
        state.books.clear();
        state.watchResults.clear();
        const removed = await writeStore(PREFIX + "key", "", true);
        $("#tmaa-api-key").value = "";
        clearHighlights();
        syncInputs();
        render();
        notice(
            removed
                ? "API key removed."
                : "Key cleared from memory. Manager storage could not be updated; remove any stored key in your manager if necessary."
        );
    }
    function selectFromInput() {
        const value = $("#tmaa-item").value.trim(),
            match = value.match(/^(\d+)(?:\s*[—-].*)?$/);
        const id = match
            ? Number(match[1])
            : Object.values(state.catalog).find((x) => x.name.toLowerCase() === value.toLowerCase())?.id;
        if (!positiveInt(id)) {
            notice("Enter an item ID, or load the catalog and choose an exact item name.", "WARN");
            return;
        }
        selectItem(id);
        runScan([id]);
    }
    function selectItem(id) {
        state.selected = id;
        syncInputs();
        render();
        highlight();
    }
    function saveTarget() {
        if (!state.selected) {
            notice("Select an item first.");
            return;
        }
        const p = prefsFor(state.selected);
        state.targets[state.selected] = { mode: p.mode, sell: p.sell, venue: p.venue };
        delete state.drafts[state.selected];
        saveConfig();
        notice("Resale strategy, venue and price saved for item " + state.selected + ".");
    }
    function clearTarget() {
        delete state.targets[state.selected];
        delete state.drafts[state.selected];
        saveConfig();
        syncInputs();
        render();
        highlight();
        notice("This item now uses your global settings.");
    }
    function addWatch() {
        if (!state.selected) {
            notice("Select an item first.");
            return;
        }
        if (!state.watch.includes(state.selected)) state.watch.push(state.selected);
        state.watch = state.watch.slice(0, 100);
        saveConfig();
        renderWatch();
        notice("Watchlist saved (" + state.watch.length + " items).");
    }
    function addVisible() {
        const root = $("#item-market-root");
        if (!root) {
            notice("Open a market category first.");
            return;
        }
        const ids = $$("[class*='itemList___'] > li", root).map(rowItem).filter(positiveInt);
        state.watch = [...new Set([...state.watch, ...ids])].slice(0, 100);
        saveConfig();
        renderWatch();
        notice("Watchlist contains " + state.watch.length + " items (maximum 100).");
    }
    async function runTask(task) {
        if (state.busy) {
            notice("A scan is already running; use Stop scan to cancel it.");
            return;
        }
        state.busy = true;
        state.scanAbort = new AbortController();
        $("#tmaa-stop", state.ui).disabled = false;
        try {
            await task(state.scanAbort.signal);
        } catch (e) {
            notice(
                e.name === "AbortError" ? "Scan stopped. Completed results are retained." : e.message || "Scan failed.",
                e.name === "AbortError" ? "INFO" : "ERROR"
            );
        } finally {
            state.busy = false;
            state.scanAbort = null;
            releaseLease();
            $("#tmaa-stop", state.ui).disabled = true;
            syncInputs();
            render();
            highlight();
        }
    }
    async function scanOne(id, signal) {
        notice("Fetching item " + id + "… (API requests are paced)");
        try {
            const b = await book(id, signal);
            state.watchResults.set(id, { at: Date.now(), error: "" });
            if (state.selected === id) syncInputs();
            render();
            highlight();
            log("item-scanned", { id, rows: b.listings.length, partial: b.partial });
            return true;
        } catch (e) {
            if (e.name === "AbortError") throw e;
            state.books.delete(id);
            state.watchResults.set(id, { at: Date.now(), error: e.message });
            render();
            highlight();
            throw e;
        }
    }
    function runScan(ids) {
        ids = [...new Set(ids)].filter(positiveInt);
        if (!ids.length) {
            notice("Select an item or add items to the watchlist first.");
            return;
        }
        if (!state.key) {
            $("#tmaa-settings").open = true;
            $("#tmaa-api-key").focus();
            notice("Add a Public API key in Settings to scan.");
            return;
        }
        runTask(async (signal) => {
            await catalog(signal);
            let completed = 0,
                failed = 0;
            for (const id of ids) {
                checkAbort(signal);
                if (!isMarket() || document.hidden) throw abortError();
                try {
                    await scanOne(id, signal);
                    completed++;
                } catch (e) {
                    if (
                        e.name === "AbortError" ||
                        state.halted ||
                        /rate limit|paused|cooldown|another tab|another TMAA/i.test(e.message)
                    )
                        throw e;
                    failed++;
                    log("scan-item-failed", { id, message: e.message }, "WARN");
                }
            }
            notice(
                "Scan complete: " +
                    completed +
                    " items updated" +
                    (failed ? ", " + failed + " failed (see results/logs)." : ".")
            );
        });
    }
    function table(headers, rows) {
        const wrap = element("div", undefined, "tmaa-table-wrap"),
            t = element("table"),
            head = element("thead"),
            tr = element("tr"),
            body = element("tbody");
        headers.forEach((h) => tr.appendChild(element("th", h)));
        head.appendChild(tr);
        rows.forEach((values) => {
            const row = element("tr");
            values.forEach((value) => {
                const td = element("td");
                value instanceof Node ? td.appendChild(value) : (td.textContent = String(value));
                row.appendChild(td);
            });
            body.appendChild(row);
        });
        t.append(head, body);
        wrap.appendChild(t);
        return wrap;
    }
    function render() {
        if (!state.ui?.isConnected) return;
        const id = state.selected,
            b = state.books.get(id),
            p = prefsFor(id),
            a = analyze(b, p, state.catalog[id]);
        const summary = $("#tmaa-summary"),
            quotes = $("#tmaa-quotes");
        summary.replaceChildren();
        quotes.replaceChildren();
        if (p.mode === "manual" && p.sell > 0) {
            const u = netUnit(p.sell, p),
                gross = p.sell * p.qty;
            if (u && Number.isSafeInteger(gross))
                summary.appendChild(
                    element(
                        "p",
                        "Manual calculator (" +
                            num(p.qty) +
                            " units): gross " +
                            money(gross) +
                            " · sales fees " +
                            money(u.tax * p.qty) +
                            " · reserve " +
                            money(u.reserve * p.qty) +
                            " · net proceeds " +
                            money(u.net * p.qty) +
                            ". Break-even buy/unit: " +
                            money(u.net) +
                            ". Maximum buy for your profit targets: " +
                            money(maxBuy(p.sell, p)) +
                            ". Purchase costs are not included in these proceeds.",
                        "tmaa-note"
                    )
                );
        }
        if (id) {
            const bar = element("div", undefined, "tmaa-bar");
            bar.appendChild(link("Open item market ↗", marketLink(id)));
            summary.appendChild(bar);
            summary.appendChild(element("p", a.reason, "tmaa-note"));
            if (b)
                summary.appendChild(
                    element(
                        "p",
                        "Quote timestamp: " +
                            new Date(b.sourceAt).toLocaleString() +
                            " · " +
                            b.listings.length +
                            " returned rows · " +
                            (b.partial
                                ? "PARTIAL depth; more listings exist or pagination changed."
                                : "All returned pages loaded.") +
                            " · Market value: " +
                            money(b.item.average),
                        "tmaa-muted"
                    )
                );
            if (a.sell) {
                const unit = netUnit(a.sell, p);
                summary.appendChild(
                    element(
                        "p",
                        "Resale/unit: " +
                            money(a.sell) +
                            " · Net after fee/reserve: " +
                            money(unit.net) +
                            " · Maximum buy at your profit targets: " +
                            money(maxBuy(a.sell, p))
                    )
                );
            }
            if (a.plan) {
                const x = a.plan;
                summary.appendChild(
                    element(
                        "p",
                        "Plan: " +
                            num(x.quantity) +
                            " units · Cost " +
                            money(x.cost) +
                            " · Estimated net profit " +
                            money(x.profit) +
                            " · ROI " +
                            x.roi.toFixed(2) +
                            "%",
                        "tmaa-good"
                    )
                );
                summary.appendChild(
                    element(
                        "p",
                        "Resale gross " +
                            money(x.gross) +
                            " − sales fees " +
                            money(x.tax) +
                            " − reserve " +
                            money(x.reserve) +
                            ". Budget and quantity are shared across all rows in this plan.",
                        "tmaa-muted"
                    )
                );
            } else if (a.sell) summary.appendChild(element("p", "No qualifying purchases fit your current settings."));
            if (b && !isStale(b, p) && !isEquipment(b)) {
                const unit = a.sell ? netUnit(a.sell, p) : null;
                quotes.appendChild(
                    table(
                        ["Buy / unit", "Available", "Plan qty", "Est. profit / unit", "Est. ROI"],
                        tiers(b.listings).map((r) => {
                            const chosen = a.plan?.rows.find((x) => x.price === r.price),
                                profit = unit ? unit.net - r.price : null;
                            return [
                                money(r.price),
                                num(r.amount),
                                chosen ? num(chosen.take) : "—",
                                profit === null ? "—" : money(profit),
                                profit === null ? "—" : ((profit / r.price) * 100).toFixed(2) + "%"
                            ];
                        })
                    )
                );
            }
        }
        renderWatch();
        scheduleExpiry();
    }
    function renderWatch() {
        const host = $("#tmaa-watch-results");
        if (!host) return;
        const rows = state.watch
            .map((id) => {
                const p = prefsFor(id),
                    b = state.books.get(id),
                    a = analyze(b, p, state.catalog[id]),
                    x = a.plan;
                const name = state.catalog[id]?.name || b?.item.name || "Item " + id;
                const actions = element("div", undefined, "tmaa-bar");
                actions.append(
                    button("View", () => selectItem(id)),
                    button("Remove", () => {
                        state.watch = state.watch.filter((n) => n !== id);
                        state.watchResults.delete(id);
                        saveConfig();
                        renderWatch();
                    })
                );
                return {
                    id,
                    profit: x?.profit || 0,
                    cells: [
                        name + " [" + id + "]",
                        x ? money(x.profit) : "—",
                        x ? x.roi.toFixed(2) + "%" : "—",
                        x ? num(x.quantity) : "—",
                        state.watchResults.get(id)?.error ||
                            (x
                                ? (b.partial ? "Partial · " : "") + new Date(b.sourceAt).toLocaleTimeString()
                                : a.reason),
                        actions
                    ]
                };
            })
            .sort((a, b) => b.profit - a.profit);
        host.replaceChildren(
            rows.length
                ? table(
                      ["Item", "Est. profit", "ROI", "Qty", "Quote / result", "Actions"],
                      rows.map((r) => r.cells)
                  )
                : element("p", "Your watchlist is empty. Add the selected item or visible category items.")
        );
    }
    function scheduleExpiry() {
        clearTimeout(state.staleTimer);
        const times = [...state.books.entries()]
            .map(([id, b]) => b.sourceAt + prefsFor(id).staleSeconds * 1000 - Date.now() + 10)
            .filter((t) => t > 0);
        if (times.length)
            state.staleTimer = setTimeout(
                () => {
                    render();
                    highlight();
                },
                Math.min(...times)
            );
    }
    function exportCSV() {
        const rows = [
            [
                "Item ID",
                "Item",
                "Strategy",
                "Venue",
                "Quote time UTC",
                "Partial depth",
                "Quantity",
                "Cost",
                "Resale unit",
                "Sales fees",
                "Reserve",
                "Estimated profit",
                "ROI percent",
                "Status"
            ]
        ];
        for (const id of state.watch) {
            const p = prefsFor(id),
                b = state.books.get(id),
                a = analyze(b, p, state.catalog[id]),
                x = a.plan;
            rows.push([
                id,
                state.catalog[id]?.name || b?.item.name || "",
                p.mode,
                p.venue,
                b ? new Date(b.sourceAt).toISOString() : "",
                b?.partial || false,
                x?.quantity || 0,
                x?.cost || 0,
                x?.sell || 0,
                x?.tax || 0,
                x?.reserve || 0,
                x?.profit || 0,
                x ? x.roi.toFixed(2) : "",
                state.watchResults.get(id)?.error || a.reason
            ]);
        }
        const csv = rows
            .map((row) =>
                row
                    .map(
                        (x) =>
                            '"' +
                            String(x)
                                .replace(/^[=+@-]/, "'$&")
                                .replace(/"/g, '""') +
                            '"'
                    )
                    .join(",")
            )
            .join("\r\n");
        const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
        const a = element("a");
        a.href = url;
        a.download = "TMAA-watchlist-" + new Date().toISOString().slice(0, 10) + ".csv";
        document.body.appendChild(a);
        a.click();
        a.remove();
        // Release a download URL after the browser has had time to consume it.
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        notice("Watchlist CSV exported without your API key.");
    }
    function reconcile() {
        state.scheduled = false;
        if (!document.body) return;
        if (!isMarket()) {
            state.scanAbort?.abort();
            if (state.ui) state.ui.hidden = true;
            clearHighlights();
            return;
        }
        injectStyle();
        const created = !state.ui;
        if (created) state.ui = buildUI();
        const needsRender = created || !state.ui.isConnected;
        state.ui.hidden = false;
        const root = $("#item-market-root");
        if (root?.parentNode) {
            if (root.previousElementSibling !== state.ui) root.parentNode.insertBefore(state.ui, root);
        } else if (!state.ui.isConnected) {
            ($("#mainContainer") || $(".content-wrapper") || document.body).prepend(state.ui);
        }
        if (needsRender) {
            syncInputs();
            populateCatalog();
            render();
        }
        if (!state.support)
            state.support = new SupportModule({
                containerId: "tmaa-support",
                styleId: "tmaa-support-style",
                getParent: () => $("#tmaa-support-host")
            });
        else {
            state.support.injectStyles();
            state.support.injectUI();
        }
        text($("#tmaa-status"), state.status);
        if (state.lastRoute !== location.href) {
            state.lastRoute = location.href;
            const id = routeItem();
            if (id && id !== state.selected) selectItem(id);
            if (id && state.key && !state.busy && !state.autoAttempt.has(id)) {
                state.autoAttempt.add(id);
                runScan([id]);
            }
        }
        highlight();
    }
    function schedule() {
        if (!state.scheduled) {
            state.scheduled = true;
            requestAnimationFrame(reconcile);
        }
    }
    function relevantMutation(m) {
        const target = m.target.nodeType === 1 ? m.target : m.target.parentElement;
        if (target?.closest("#tmaa-dashboard,[id^='us-debug-']")) return false;
        if (m.type === "characterData" || m.type === "attributes") return !!target?.closest("#item-market-root");
        return (
            Array.from(m.addedNodes)
                .concat(Array.from(m.removedNodes))
                .some(
                    (n) =>
                        !(
                            n.nodeType === 1 &&
                            (n.id?.startsWith("us-debug-") ||
                                n.id === "tmaa-dashboard" ||
                                n.id?.startsWith("tmaa-support"))
                        )
                ) || !state.ui?.isConnected
        );
    }
    async function start() {
        const saved = await readStore(PREFIX + "config", null);
        if (saved) {
            state.prefs = validatePrefs(saved.prefs);
            state.watch = Array.isArray(saved.watch) ? [...new Set(saved.watch.filter(positiveInt))].slice(0, 100) : [];
            if (saved.targets && typeof saved.targets === "object")
                for (const [id, raw] of Object.entries(saved.targets)) {
                    if (/^[1-9]\d*$/.test(id) && raw && typeof raw === "object") {
                        const p = validatePrefs(raw);
                        state.targets[id] = { mode: p.mode, venue: p.venue, sell: p.sell };
                    }
                }
        } else {
            const oldFee = Number(await readStore("tmaa_feeRate", 5.26)),
                oldAnon = await readStore("tmaa_isAnon", false);
            state.prefs = validatePrefs({ baseFee: oldFee === 5.26 ? 5 : oldFee, anonymous: oldAnon === true });
        }
        const savedKey = await readStore(PREFIX + "key", "", true);
        state.key = typeof savedKey === "string" && /^[a-zA-Z0-9]{16}$/.test(savedKey) ? savedKey : "";
        state.keyStored = !!state.key;
        const cached = await readStore(PREFIX + "catalog", null);
        if (
            cached &&
            validCatalogCache(cached.items) &&
            Number.isFinite(cached.at) &&
            cached.at <= Date.now() &&
            Date.now() - cached.at < 86400000
        ) {
            state.catalog = cached.items;
            state.catalogAt = cached.at;
        }
        state.observer = new MutationObserver((ms) => {
            if (state.lastRoute !== location.href || ms.some(relevantMutation)) schedule();
        });
        state.observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ["data-item-id", "data-itemid", "src"]
        });
        window.addEventListener("hashchange", schedule);
        window.addEventListener("popstate", schedule);
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) state.scanAbort?.abort();
            else {
                schedule();
                render();
            }
        });
        window.addEventListener("pagehide", () => {
            state.scanAbort?.abort();
            releaseLease();
            clearTimeout(state.staleTimer);
        });
        window.addEventListener("pageshow", schedule);
        reconcile();
        if (!state.key && state.ui) $("#tmaa-settings").open = true;
        log("initialized", { version: VERSION, keyPresent: !!state.key });
    }

    // Embedded Donation UI Module 1.4; settings-host and style-identity fixes.
    const DEFAULT_CONFIG = Object.freeze({
        bmcId: "bittick1c",
        tornUserId: "2954173",
        containerId: "thawookie-support-module",
        styleId: "thawookie-support-module-style",
        getParent: null
    });
    let coffeeInstanceCount = 0;
    class SupportModule {
        constructor(config = {}) {
            this.config = { ...DEFAULT_CONFIG, ...config };
            this.observer = null;
            this.observerAttached = false;
            this.isInjecting = false;
            this.destroyed = false;
            this.init();
        }
        init() {
            if (this.destroyed) {
                return;
            }
            if (!this.getBody()) {
                if (document.readyState === "loading") {
                    document.addEventListener("DOMContentLoaded", () => this.init(), { once: true });
                }
                return;
            }
            this.injectStyles();
            this.injectUI();
            this.attachObserver();
        }
        getBody() {
            return typeof this.config.getParent === "function" ? this.config.getParent() : document.body || null;
        }
        getContainer() {
            return document.getElementById(this.config.containerId);
        }
        isContainerConnected() {
            const container = this.getContainer();
            return Boolean(container && container.isConnected);
        }
        injectStyles() {
            if (this.destroyed) {
                return;
            }
            if (document.getElementById(this.config.styleId)) {
                return;
            }
            const styles = `
#${this.config.containerId} {
position: fixed;
bottom: 20px;
right: 20px;
z-index: 2147483640;
display: flex;
flex-direction: column;
gap: 10px;
font-family: Arial, sans-serif;
box-sizing: border-box;
touch-action: manipulation;
}
#${this.config.containerId} .tw-support-btn {
box-sizing: border-box;
display: flex;
align-items: center;
justify-content: center;
min-height: 40px;
padding: 10px 15px;
border-radius: 8px;
font-size: 13px;
font-weight: bold;
line-height: 1.2;
text-align: center;
text-decoration: none !important;
cursor: pointer;
user-select: none;
-webkit-tap-highlight-color: transparent;
touch-action: manipulation;
}
#${this.config.containerId} .tw-support-btn:focus-visible {
outline: 2px solid #ffffff;
outline-offset: 2px;
}
#${this.config.containerId} .tw-bmc {
position: relative;
overflow: hidden;
isolation: isolate;
display: flex;
align-items: center;
justify-content: center;
gap: 6px;
width: 100%;
min-width: 170px;
min-height: 40px;
padding: 6px 12px;
background: #FFDD00;
color: #000000 !important;
border: 1px solid #FFDD00;
border-radius: 6px;
font-size: 11px;
font-weight: 600;
line-height: 1.2;
text-decoration: none !important;
box-sizing: border-box;
transition:
opacity 0.15s ease,
transform 0.15s ease;
}
#${this.config.containerId} .tw-bmc > * {
position: relative;
z-index: 1;
}
#${this.config.containerId} .tw-bmc:hover {
opacity: 0.9;
}
#${this.config.containerId} .tw-bmc:active {
transform: scale(0.97);
}
@keyframes tmaa-coffee-cup-hop {
0% {
transform:
translateY(0)
scale(1, 1);
}
18% {
transform:
translateY(0.5px)
scale(1.08, 0.9);
}
32% {
transform:
translateY(-2px)
scale(0.94, 1.08);
}
50% {
transform:
translateY(-3px)
scale(1, 1);
}
68% {
transform:
translateY(0)
scale(1.1, 0.88);
}
84% {
transform:
translateY(0)
scale(0.97, 1.03);
}
100% {
transform:
translateY(0)
scale(1, 1);
}
}
#${this.config.containerId} .tw-coffee-cup {
position: relative;
display: inline-flex;
flex-shrink: 0;
transform-origin: 50% 100%;
animation:
tmaa-coffee-cup-hop
2.4s
cubic-bezier(0.4, 0, 0.5, 1)
infinite;
}
#${this.config.containerId} .tw-coffee-cup > svg {
position: relative;
z-index: 1;
display: block;
}
#${this.config.containerId} .tw-coffee-cup::before,
#${this.config.containerId} .tw-coffee-cup::after {
content: "";
position: absolute;
bottom: 74%;
width: 2px;
height: 4px;
border-radius: 999px;
background:
linear-gradient(
to top,
rgba(90, 58, 36, 0.5),
rgba(90, 58, 36, 0) );
opacity: 0;
pointer-events: none;
will-change:
transform,
opacity;
}
#${this.config.containerId} .tw-coffee-cup::before {
left: 27%;
animation:
tmaa-coffee-steam
2.8s
ease-out
infinite;
}
#${this.config.containerId} .tw-coffee-cup::after {
left: 45%;
animation:
tmaa-coffee-steam
2.8s
ease-out
infinite;
animation-delay: -1.4s;
}
@keyframes tmaa-coffee-steam {
0% {
opacity: 0;
transform:
translateY(2px)
scale(0.6, 0.5)
skewX(0deg);
}
30% {
opacity: 0.7;
transform:
translateY(0)
scale(1, 0.9)
skewX(4deg);
}
65% {
opacity: 0.4;
transform:
translateY(-3px)
scale(0.85, 1.2)
skewX(-5deg);
}
100% {
opacity: 0;
transform:
translateY(-5px)
scale(0.5, 1.5)
skewX(6deg);
}
}
#${this.config.containerId} .tw-coffee-fill {
transform: scaleY(0.15);
transform-origin: 50% 100%;
animation:
tmaa-coffee-refill
7s
cubic-bezier(0.45, 0, 0.55, 1)
infinite;
}
@keyframes tmaa-coffee-refill {
0% {
transform: scaleY(0.15);
}
30% {
transform: scaleY(0.95);
}
55% {
transform: scaleY(0.75);
}
80% {
transform: scaleY(0.3);
}
100% {
transform: scaleY(0.15);
}
}
#${this.config.containerId} .tw-bmc:is(:hover, :focus-visible, :active) .tw-coffee-fill {
animation:
tmaa-coffee-fill-to-full
0.45s
cubic-bezier(0.4, 0, 0.2, 1)
forwards;
}
@keyframes tmaa-coffee-fill-to-full {
to {
transform: scaleY(1);
}
}
#${this.config.containerId} .tw-bmc::after {
content: "";
position: absolute;
top: 0;
bottom: 0;
left: -60%;
width: 45%;
pointer-events: none;
background:
linear-gradient(
100deg,
transparent 0%,
rgba(255, 255, 255, 0.15) 35%,
rgba(255, 255, 255, 0.75) 50%,
rgba(255, 255, 255, 0.15) 65%,
transparent 100% );
transform: skewX(-18deg);
will-change: transform;
animation:
tmaa-coffee-glare
5s
cubic-bezier(0.5, 0, 0.5, 1)
infinite;
}
@keyframes tmaa-coffee-glare {
0% {
transform:
translateX(0)
skewX(-18deg);
}
22%,
100% {
transform:
translateX(400%)
skewX(-18deg);
}
}
#${this.config.containerId} .tw-coffee-label {
display: grid;
align-items: center;
justify-items: center;
min-width: 0;
}
#${this.config.containerId} .tw-coffee-label > span {
grid-area: 1 / 1;
white-space: nowrap;
transform-origin: 50% 50%;
will-change:
opacity,
transform,
filter;
animation:
tmaa-coffee-label-drip
7s
cubic-bezier(0.65, 0, 0.35, 1)
infinite;
}
#${this.config.containerId} .tw-coffee-label
> span:nth-child(2) {
animation-delay: -3.5s;
}
@keyframes tmaa-coffee-label-drip {
0%,
34% {
opacity: 1;
transform:
translateY(0)
scale(1, 1);
filter: blur(0);
}
38% {
opacity: 0.5;
transform:
translateY(2px)
scale(0.94, 1.08);
filter: blur(1.2px);
}
42% {
opacity: 0;
transform:
translateY(9px)
scale(1.06, 0.5);
filter: blur(4px);
}
42.01%,
92% {
opacity: 0;
transform:
translateY(-9px)
scale(1.06, 0.5);
filter: blur(4px);
}
96% {
opacity: 1;
transform:
translateY(1px)
scale(1.05, 0.9);
filter: blur(0);
}
98% {
opacity: 1;
transform:
translateY(0)
scale(0.99, 1.03);
filter: blur(0);
}
100% {
opacity: 1;
transform:
translateY(0)
scale(1, 1);
filter: blur(0);
}
}
#${this.config.containerId} .tw-torn-tip {
background-color: #8ab63d;
color: #ffffff !important;
border: 1px solid #6a8c2f;
box-shadow:
0 4px 6px rgba(0, 0, 0, 0.3);
transition:
transform 0.2s ease,
background-color 0.2s ease;
}
#${this.config.containerId} .tw-torn-tip:active {
transform: scale(0.95);
}
@media (prefers-reduced-motion: reduce) {
#${this.config.containerId} .tw-coffee-cup {
animation: none;
}
#${this.config.containerId} .tw-coffee-cup::before,
#${this.config.containerId} .tw-coffee-cup::after {
animation: none;
opacity: 0;
}
#${this.config.containerId} .tw-coffee-fill {
animation: none;
transform: scaleY(0.8);
}
#${this.config.containerId} .tw-coffee-label > span {
animation: none;
opacity: 0;
filter: none;
transform: none;
}
#${this.config.containerId} .tw-coffee-label
> span:nth-child(2) {
opacity: 1;
}
#${this.config.containerId} .tw-bmc::after {
animation: none;
opacity: 0;
}
}
@media (max-width: 480px) {
#${this.config.containerId} {
right: 10px;
bottom: 10px;
left: 10px;
width: auto;
}
#${this.config.containerId} .tw-support-btn {
width: 100%;
}
#${this.config.containerId} .tw-bmc {
min-width: 0;
}
}
`;
            this.injectStyleElement(styles);
        }
        injectStyleElement(styles) {
            if (document.getElementById(this.config.styleId)) {
                return;
            }
            const styleNode = document.createElement("style");
            styleNode.id = this.config.styleId;
            styleNode.type = "text/css";
            styleNode.textContent = styles;
            if (document.head) {
                document.head.appendChild(styleNode);
                return;
            }
            const body = this.getBody();
            if (body) {
                body.appendChild(styleNode);
            }
        }
        buildCoffeeButton() {
            coffeeInstanceCount += 1;
            const clipId = `tmaa-coffee-clip-${Date.now().toString(36)}-${coffeeInstanceCount}-${Math.random().toString(36).slice(2)}`;
            const bmcLink = document.createElement("a");
            bmcLink.className = "tw-support-btn tw-bmc";
            bmcLink.href = `https://www.buymeacoffee.com/${encodeURIComponent(this.config.bmcId)}`;
            bmcLink.target = "_blank";
            bmcLink.rel = "noopener noreferrer";
            bmcLink.title = "Support ThaWookie";
            bmcLink.setAttribute("aria-label", "Buy me a coffee — support ThaWookie");
            const cup = document.createElement("span");
            cup.className = "tw-coffee-cup";
            cup.setAttribute("aria-hidden", "true");
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("width", "16");
            svg.setAttribute("height", "16");
            svg.setAttribute("viewBox", "0 0 24 24");
            svg.setAttribute("fill", "none");
            svg.setAttribute("stroke", "currentColor");
            svg.setAttribute("stroke-width", "1.5");
            svg.setAttribute("aria-hidden", "true");
            const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
            const clipPath = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
            clipPath.setAttribute("id", clipId);
            const clipShape = document.createElementNS("http://www.w3.org/2000/svg", "path");
            clipShape.setAttribute("d", "M5 8h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8z");
            clipPath.appendChild(clipShape);
            defs.appendChild(clipPath);
            svg.appendChild(defs);
            const coffeeFill = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            coffeeFill.setAttribute("class", "tw-coffee-fill");
            coffeeFill.setAttribute("x", "5");
            coffeeFill.setAttribute("y", "8");
            coffeeFill.setAttribute("width", "11");
            coffeeFill.setAttribute("height", "9");
            coffeeFill.setAttribute("fill", "#6f4e37");
            coffeeFill.setAttribute("stroke", "none");
            coffeeFill.setAttribute("clip-path", `url(#${clipId})`);
            svg.appendChild(coffeeFill);
            const cupBody = document.createElementNS("http://www.w3.org/2000/svg", "path");
            cupBody.setAttribute("stroke-linecap", "round");
            cupBody.setAttribute("stroke-linejoin", "round");
            cupBody.setAttribute("d", "M5 8h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8z");
            svg.appendChild(cupBody);
            const cupHandle = document.createElementNS("http://www.w3.org/2000/svg", "path");
            cupHandle.setAttribute("stroke-linecap", "round");
            cupHandle.setAttribute("stroke-linejoin", "round");
            cupHandle.setAttribute("d", "M16 9h2.5a2.5 2.5 0 0 1 0 5H16");
            svg.appendChild(cupHandle);
            cup.appendChild(svg);
            bmcLink.appendChild(cup);
            const label = document.createElement("span");
            label.className = "tw-coffee-label";
            label.setAttribute("aria-hidden", "true");
            const supportLabel = document.createElement("span");
            supportLabel.textContent = "Support the project?";
            const coffeeLabel = document.createElement("span");
            coffeeLabel.textContent = "Buy me a coffee";
            label.appendChild(supportLabel);
            label.appendChild(coffeeLabel);
            bmcLink.appendChild(label);
            return bmcLink;
        }
        injectUI() {
            if (this.destroyed || this.isInjecting) {
                return;
            }
            const body = this.getBody();
            if (!body) {
                return;
            }
            if (this.isContainerConnected()) {
                return;
            }
            this.isInjecting = true;
            try {
                const existingContainer = this.getContainer();
                if (existingContainer) {
                    existingContainer.remove();
                }
                const container = document.createElement("div");
                container.id = this.config.containerId;
                container.setAttribute("role", "complementary");
                container.setAttribute("aria-label", "Support ThaWookie");
                const bmcLink = this.buildCoffeeButton();
                const tipLink = document.createElement("a");
                tipLink.href = "https://www.torn.com/item.php";
                tipLink.target = "_blank";
                tipLink.rel = "noopener noreferrer";
                tipLink.className = "tw-support-btn tw-torn-tip";
                tipLink.title =
                    `Opens Items — search "Xanax", ` + `tap Send, enter ThaWookie ` + `[${this.config.tornUserId}]`;
                tipLink.setAttribute("aria-label", `Send a Xanax tip to ThaWookie ` + `[${this.config.tornUserId}]`);
                tipLink.textContent = "💊 Send a Xanax Tip";
                container.appendChild(bmcLink);
                container.appendChild(tipLink);
                body.appendChild(container);
            } finally {
                this.isInjecting = false;
            }
        }
        attachObserver() {
            if (this.destroyed || this.observerAttached || typeof MutationObserver === "undefined") {
                return;
            }
            const body = this.getBody();
            if (!body) {
                return;
            }
            this.observer = new MutationObserver((mutationList) => {
                if (this.destroyed || this.isInjecting) {
                    return;
                }
                let relevantMutation = false;
                for (const mutation of mutationList) {
                    if (mutation.type !== "childList") {
                        continue;
                    }
                    if (mutation.removedNodes.length > 0) {
                        relevantMutation = true;
                        break;
                    }
                }
                if (!relevantMutation) {
                    return;
                }
                if (!this.isContainerConnected()) {
                    this.injectStyles();
                    this.injectUI();
                }
            });
            this.observer.observe(body, {
                childList: true,
                subtree: true
            });
            this.observerAttached = true;
        }
        destroy() {
            this.destroyed = true;
            if (this.observer) {
                try {
                    this.observer.disconnect();
                } catch (_) {}
            }
            this.observer = null;
            this.observerAttached = false;
            const container = this.getContainer();
            if (container) {
                container.remove();
            }
        }
    }
    // Embedded Modular Debugger 1.0.2; clipboard, redaction and buffer fixes.
    function initializeModularDebugger(scriptNamespace) {
        "use strict";
        scriptNamespace = scriptNamespace || "App";
        const randomSuffix = (() => {
            try {
                if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
                    return crypto.randomUUID().replace(/-/g, "");
                }
            } catch (_) {}
            return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
        })();
        const prefix = `us-debug-${randomSuffix}`;
        const CONTAINER_ID = `${prefix}-box`;
        const LOG_AREA_ID = `${prefix}-logs`;
        const CLIPBOARD_MAX_CHARS = 640 * 1024;
        const BUFFER_REDUCTION_MARGIN = 128 * 1024;
        const MAX_LOG_STRING_LENGTH = CLIPBOARD_MAX_CHARS - BUFFER_REDUCTION_MARGIN;
        const MAX_SINGLE_LOG_LENGTH = 16384;
        const state = {
            logs: [],
            currentBufferLength: 0,
            domElements: {
                container: null,
                logArea: null
            },
            observer: null,
            observerAttached: false,
            destroyed: false
        };
        function getDocumentBody() {
            return document && document.body ? document.body : null;
        }
        function getExistingContainer() {
            return document.getElementById(CONTAINER_ID);
        }
        function isContainerAttached() {
            return Boolean(state.domElements.container && state.domElements.container.isConnected);
        }
        function ensureObserver() {
            if (state.observerAttached || typeof MutationObserver === "undefined") {
                return;
            }
            const body = getDocumentBody();
            if (!body) {
                return;
            }
            state.observer = new MutationObserver(() => {
                if (state.domElements.container && !state.domElements.container.isConnected) {
                    state.domElements.container = null;
                    state.domElements.logArea = null;
                }
            });
            state.observer.observe(body, {
                childList: true,
                subtree: true
            });
            state.observerAttached = true;
        }
        function appendToBody(element) {
            const body = getDocumentBody();
            if (!body || !element) {
                return false;
            }
            body.appendChild(element);
            return true;
        }
        function safeSerialize(value) {
            if (typeof value === "string") {
                return value;
            }
            if (
                value === null ||
                typeof value === "number" ||
                typeof value === "boolean" ||
                typeof value === "bigint"
            ) {
                try {
                    return String(value);
                } catch (_) {
                    return "[Unserializable Primitive]";
                }
            }
            if (typeof value === "undefined") {
                return "undefined";
            }
            if (typeof value === "symbol") {
                try {
                    return value.toString();
                } catch (_) {
                    return "[Symbol]";
                }
            }
            if (typeof value === "function") {
                try {
                    return `[Function: ${value.name || "anonymous"}]`;
                } catch (_) {
                    return "[Function]";
                }
            }
            if (value instanceof Error) {
                const errorObject = {
                    name: value.name,
                    message: value.message,
                    stack: value.stack
                };
                try {
                    return JSON.stringify(errorObject);
                } catch (_) {
                    return `${value.name || "Error"}: ${value.message || ""}`;
                }
            }
            try {
                const seen = new WeakSet();
                const serialized = JSON.stringify(value, (key, nestedValue) => {
                    if (typeof nestedValue === "bigint") {
                        return `${nestedValue}n`;
                    }
                    if (typeof nestedValue === "undefined") {
                        return "[undefined]";
                    }
                    if (typeof nestedValue === "object" && nestedValue !== null) {
                        if (seen.has(nestedValue)) {
                            return "[Circular]";
                        }
                        seen.add(nestedValue);
                    }
                    return nestedValue;
                });
                if (typeof serialized === "string") {
                    return serialized;
                }
            } catch (_) {}
            try {
                return String(value);
            } catch (_) {
                return "[Serialization Error]";
            }
        }
        function truncateLogEntry(entry) {
            if (entry.length <= MAX_SINGLE_LOG_LENGTH) {
                return entry;
            }
            return entry.slice(0, MAX_SINGLE_LOG_LENGTH - 40) + "\n...[LOG ENTRY TRUNCATED]...";
        }
        function pruneBufferForEntry(entryLength) {
            while (
                state.logs.length > 0 &&
                (state.currentBufferLength + entryLength > MAX_LOG_STRING_LENGTH || state.logs.length >= 2000)
            ) {
                const removed = state.logs.shift();
                if (typeof removed === "string") {
                    state.currentBufferLength -= removed.length + 1;
                }
            }
            if (state.currentBufferLength < 0) {
                state.currentBufferLength = 0;
            }
        }
        function renderLogs() {
            const logArea = state.domElements.logArea;
            if (!logArea || !logArea.isConnected || state.domElements.container?.style.display === "none") {
                return;
            }
            logArea.textContent = state.logs.join("\n").slice(-65536);
            const container = state.domElements.container;
            if (container && container.isConnected) {
                container.scrollTop = container.scrollHeight;
            }
        }
        function log(message, level = "INFO") {
            const time = new Date().toLocaleTimeString();
            let cleanMessage = safeSerialize(message)
                .replace(/([?&](?:key|api_key)=)[^&\s]+/gi, "$1[REDACTED]")
                .replace(/ApiKey\s+[a-zA-Z0-9]+/gi, "ApiKey [REDACTED]")
                .replace(/\b[a-zA-Z0-9]{16}\b/g, "[REDACTED]");
            cleanMessage = truncateLogEntry(cleanMessage);
            const normalizedLevel = typeof level === "string" ? level.toUpperCase() : "INFO";
            let entry = `[${time}] [${normalizedLevel}] ${cleanMessage}`;
            entry = truncateLogEntry(entry);
            const entryLength = entry.length + 1;
            if (entry.length > MAX_LOG_STRING_LENGTH) {
                return;
            }
            pruneBufferForEntry(entryLength);
            state.logs.push(entry);
            state.currentBufferLength += entryLength;
            renderLogs();
        }
        function info(message) {
            log(message, "INFO");
        }
        function warn(message) {
            log(message, "WARN");
        }
        function error(message) {
            log(message, "ERROR");
        }
        function clearLogs() {
            state.logs.length = 0;
            state.currentBufferLength = 0;
            renderLogs();
        }
        function setButtonStatus(button, text, statusClass = "") {
            if (!button) {
                return;
            }
            button.textContent = text;
            if (statusClass) {
                button.dataset.debugStatus = statusClass;
            } else {
                delete button.dataset.debugStatus;
            }
        }
        function prepareStatusAnimation(button) {
            if (!button) {
                return;
            }
            if (button.dataset.debugStatusListener === "1") {
                return;
            }
            button.dataset.debugStatusListener = "1";
            button.addEventListener("animationend", (event) => {
                if (event.animationName !== "us-debug-status-reset") {
                    return;
                }
                const originalText = button.dataset.debugOriginalText || "Copy Logs";
                button.textContent = originalText;
                delete button.dataset.debugStatus;
            });
        }
        function showCopyStatus(button, text, originalText = null) {
            if (!button) {
                return;
            }
            injectStyles();
            prepareStatusAnimation(button);
            if (originalText) {
                button.dataset.debugOriginalText = originalText;
            } else if (!button.dataset.debugOriginalText) {
                button.dataset.debugOriginalText = button.textContent || "Copy Logs";
            }
            button.classList.remove("us-debug-status-reset");
            void button.offsetWidth;
            button.textContent = text;
            button.classList.add("us-debug-status-reset");
        }
        async function copyLogs(buttonElement = null) {
            const payload = state.logs.join("\n");
            try {
                if (typeof GM_setClipboard === "function") {
                    await GM_setClipboard(payload, "text");
                    showCopyStatus(buttonElement, "Copied!");
                    return true;
                }
                if (typeof GM !== "undefined" && typeof GM.setClipboard === "function") {
                    await GM.setClipboard(payload, "text");
                    showCopyStatus(buttonElement, "Copied!");
                    return true;
                }
            } catch (_) {}
            if (!payload) {
                showCopyStatus(buttonElement, "Empty!");
                return false;
            }
            if (
                typeof navigator !== "undefined" &&
                navigator.clipboard &&
                typeof navigator.clipboard.writeText === "function"
            ) {
                try {
                    await navigator.clipboard.writeText(payload);
                    showCopyStatus(buttonElement, "Copied!");
                    return true;
                } catch (_) {}
            }
            const success = handleCopyFallback(payload);
            if (success) {
                showCopyStatus(buttonElement, "Copied!");
                return true;
            }
            showCopyStatus(buttonElement, "Failed!");
            return false;
        }
        function handleCopyFallback(textData) {
            try {
                const body = getDocumentBody();
                if (!body) {
                    return false;
                }
                const textarea = document.createElement("textarea");
                textarea.value = textData;
                textarea.setAttribute("readonly", "");
                textarea.style.position = "fixed";
                textarea.style.top = "0";
                textarea.style.left = "0";
                textarea.style.width = "1px";
                textarea.style.height = "1px";
                textarea.style.padding = "0";
                textarea.style.border = "0";
                textarea.style.outline = "0";
                textarea.style.boxShadow = "none";
                textarea.style.background = "transparent";
                textarea.style.opacity = "0";
                body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                try {
                    textarea.setSelectionRange(0, textarea.value.length);
                } catch (_) {}
                let success = false;
                try {
                    success = document.execCommand("copy");
                } catch (_) {
                    success = false;
                }
                textarea.remove();
                return Boolean(success);
            } catch (copyError) {
                error({
                    operation: "clipboard-fallback",
                    message: copyError && copyError.message ? copyError.message : String(copyError)
                });
                return false;
            }
        }
        function injectStyles() {
            if (document.getElementById(`${prefix}-style`)) {
                return;
            }
            const styleNode = document.createElement("style");
            styleNode.id = `${prefix}-style`;
            styleNode.textContent = `
@keyframes us-debug-status-reset {
from {
opacity: 0.75;
}
to {
opacity: 1;
}
} .us-debug-status-reset {
animation: us-debug-status-reset 1.5s ease-in-out 1;
}
`;
            const head = document.head;
            if (head) {
                head.appendChild(styleNode);
            } else {
                const body = getDocumentBody();
                if (body) {
                    body.appendChild(styleNode);
                }
            }
        }
        function createDebuggerContainer() {
            const body = getDocumentBody();
            if (!body) {
                return null;
            }
            const existingContainer = getExistingContainer();
            if (existingContainer) {
                state.domElements.container = existingContainer;
                const existingLogArea = document.getElementById(LOG_AREA_ID);
                state.domElements.logArea = existingLogArea;
                renderLogs();
                return existingContainer;
            }
            injectStyles();
            const container = document.createElement("div");
            container.id = CONTAINER_ID;
            container.style.cssText = [
                "position:fixed",
                "bottom:12px",
                "right:12px",
                "width:calc(100% - 24px)",
                "max-width:420px",
                "height:280px",
                "background:#181818",
                "color:#00ff66",
                "font-family:monospace",
                "font-size:11px",
                "padding:12px",
                "z-index:2147483647",
                "border:1px solid #00ff66",
                "overflow-y:auto",
                "overflow-x:hidden",
                "box-shadow:0 4px 20px rgba(0,0,0,0.7)",
                "border-radius:4px",
                "box-sizing:border-box",
                "touch-action:pan-y"
            ].join(";");
            const header = document.createElement("div");
            header.style.cssText = [
                "display:flex",
                "justify-content:space-between",
                "align-items:center",
                "gap:8px",
                "margin-bottom:8px",
                "border-bottom:1px solid #333",
                "padding-bottom:5px",
                "user-select:none"
            ].join(";");
            const title = document.createElement("span");
            title.textContent = `DEBUG LOG [${String(scriptNamespace)}]`;
            title.style.cssText = [
                "font-weight:bold",
                "letter-spacing:0.5px",
                "overflow:hidden",
                "text-overflow:ellipsis",
                "white-space:nowrap"
            ].join(";");
            const buttonGroup = document.createElement("div");
            buttonGroup.style.cssText = ["display:flex", "gap:6px", "flex-shrink:0"].join(";");
            const copyBtn = document.createElement("button");
            copyBtn.type = "button";
            copyBtn.textContent = "Copy";
            copyBtn.style.cssText = [
                "background:#2a2a2a",
                "color:#fff",
                "border:1px solid #444",
                "cursor:pointer",
                "padding:5px 8px",
                "font-size:10px",
                "border-radius:3px",
                "touch-action:manipulation"
            ].join(";");
            copyBtn.addEventListener("click", () => {
                void copyLogs(copyBtn);
            });
            const clearBtn = document.createElement("button");
            clearBtn.type = "button";
            clearBtn.textContent = "Clear";
            clearBtn.style.cssText = [
                "background:#2a2a2a",
                "color:#fff",
                "border:1px solid #444",
                "cursor:pointer",
                "padding:5px 8px",
                "font-size:10px",
                "border-radius:3px",
                "touch-action:manipulation"
            ].join(";");
            clearBtn.addEventListener("click", () => {
                clearLogs();
            });
            const closeBtn = document.createElement("button");
            closeBtn.type = "button";
            closeBtn.textContent = "Hide";
            closeBtn.style.cssText = [
                "background:#a82020",
                "color:#fff",
                "border:none",
                "cursor:pointer",
                "padding:5px 8px",
                "font-size:10px",
                "border-radius:3px",
                "touch-action:manipulation"
            ].join(";");
            closeBtn.addEventListener("click", () => {
                container.style.display = "none";
            });
            const logArea = document.createElement("div");
            logArea.id = LOG_AREA_ID;
            logArea.style.cssText = [
                "white-space:pre-wrap",
                "overflow-wrap:anywhere",
                "word-break:break-word",
                "font-family:monospace",
                "line-height:1.4",
                "user-select:text"
            ].join(";");
            buttonGroup.appendChild(copyBtn);
            buttonGroup.appendChild(clearBtn);
            buttonGroup.appendChild(closeBtn);
            header.appendChild(title);
            header.appendChild(buttonGroup);
            container.appendChild(header);
            container.appendChild(logArea);
            if (!appendToBody(container)) {
                return null;
            }
            state.domElements.container = container;
            state.domElements.logArea = logArea;
            renderLogs();
            return container;
        }
        function toggleConsoleView() {
            const existingContainer = getExistingContainer();
            if (existingContainer) {
                state.domElements.container = existingContainer;
                const existingLogArea = document.getElementById(LOG_AREA_ID);
                state.domElements.logArea = existingLogArea;
                const isHidden = existingContainer.style.display === "none";
                existingContainer.style.display = isHidden ? "block" : "none";
                if (isHidden) {
                    renderLogs();
                }
                ensureObserver();
                return;
            }
            const container = createDebuggerContainer();
            if (container) {
                container.style.display = "block";
                renderLogs();
            }
            ensureObserver();
        }
        function initialize() {
            if (state.destroyed) {
                return;
            }
            ensureObserver();
            if (getDocumentBody()) {
                return;
            }
            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", initialize, { once: true });
            }
        }
        initialize();
        return Object.freeze({
            log,
            info,
            warn,
            error,
            copy: copyLogs,
            toggleView: toggleConsoleView,
            clear: clearLogs
        });
    }
    function startupFailure(e) {
        log("startup-failed", { message: e.message }, "ERROR");
        if (isMarket() && document.body) {
            const error = element("p", "TMAA could not initialize. Open the debugger to copy diagnostic logs.");
            error.style.cssText = "background:#3b2424;color:white;padding:16px";
            error.append(
                button("🪲", () => MyDebug.toggleView()),
                button("📋 Copy Logs to Clipboard", function () {
                    MyDebug.copy(this);
                })
            );
            document.body.prepend(error);
        }
    }
    if (document.readyState === "loading")
        document.addEventListener("DOMContentLoaded", () => start().catch(startupFailure), { once: true });
    else start().catch(startupFailure);
})(
    typeof GM_info !== "undefined" && GM_info?.script
        ? GM_info
        : typeof GM !== "undefined" && GM.info?.script
          ? GM.info
          : { script: { name: "Torn Market Arbitrage Assistant (TMAA)", version: "1.0.1" } }
);
