// ==UserScript==
// @name         Torn Market Arbitrage Assistant (TMAA)
// @namespace    https://github.com/ShavedW00kie/
// @version      1.0
// @description  Calculates profitable arbitrage opportunities on the item market and highlights them in green.
// @author       ShavedW00kie (Torn: ThaWookie [2954173] )
// @match        https://www.torn.com/page.php?sid=ItemMarket*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @license      BSD-3-Clause
// @run-at       document-end
// ==/UserScript==

(function() {
    "use strict";

    // --- CONFIGURATION & STATE ---
    const STATE = {
        sellPrice: 0,
        qty: 1,
        feeRate: parseFloat(GM_getValue("tmaa_feeRate", "5.26")),
        isAnon: GM_getValue("tmaa_isAnon", false)
    };

    // --- CSS INJECTION ---
    const injectStyles = () => {
        const css = `
            #tmaa-dashboard {
                background: #222;
                color: #fff;
                border: 2px solid #555;
                border-radius: 8px;
                padding: 15px;
                margin-bottom: 15px;
                font-family: Arial, sans-serif;
                box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                display: flex;
                flex-wrap: wrap;
                gap: 15px;
                align-items: center;
                justify-content: space-between;
                z-index: 1000;
            }
            .tmaa-group {
                display: flex;
                flex-direction: column;
                gap: 5px;
            }
            .tmaa-group label {
                font-size: 12px;
                font-weight: bold;
                color: #ccc;
            }
            .tmaa-group input[type="number"] {
                background: #333;
                border: 1px solid #777;
                color: #fff;
                padding: 5px;
                border-radius: 4px;
                width: 100px;
            }
            .tmaa-group input[type="checkbox"] {
                transform: scale(1.2);
                cursor: pointer;
            }
            .tmaa-results {
                background: #111;
                padding: 10px;
                border-radius: 6px;
                border: 1px solid #444;
                min-width: 200px;
            }
            .tmaa-results p {
                margin: 0;
                font-size: 13px;
                line-height: 1.6;
            }
            .tmaa-results .highlight {
                color: #00FF00;
                font-weight: bold;
            }
            .tmaa-profit-row {
                background-color: #00FF00 !important;
                color: #000000 !important;
                transition: background-color 0.3s ease;
            }
            .tmaa-profit-row * {
                color: #000000 !important;
            }
        `;
        if (typeof GM_addStyle !== "undefined") {
            GM_addStyle(css);
        } else {
            const style = document.createElement("style");
            style.textContent = css;
            document.head.appendChild(style);
        }
    };

    // --- ARBITRAGE MATH ---
    const calculateArbitrage = () => {
        const totalFeePercent = STATE.feeRate + (STATE.isAnon ? 10.0 : 0.0);
        const feeMultiplier = totalFeePercent / 100;
        
        const totalRevenue = STATE.sellPrice * STATE.qty;
        const totalFeeAmount = totalRevenue * feeMultiplier;
        const netRevenue = totalRevenue - totalFeeAmount;
        
        // Break-even: Price at which buying an item leaves exactly 0 profit when sold at sellPrice
        const breakEvenPrice = STATE.sellPrice * (1 - feeMultiplier);

        updateUIDisplay(totalRevenue, totalFeeAmount, breakEvenPrice);
        highlightMarketListings(breakEvenPrice);
    };

    // --- DOM MANIPULATION & UI ---
    const updateUIDisplay = (revenue, fee, breakEven) => {
        const display = document.getElementById("tmaa-break-even-display");
        const revDisplay = document.getElementById("tmaa-rev-display");
        if (display && revDisplay) {
            revDisplay.innerHTML = `Gross: $${revenue.toLocaleString()} | Fee: $${fee.toLocaleString()}`;
            display.innerHTML = `Max Buy Price: <span class="highlight">$${Math.floor(breakEven).toLocaleString()}</span>`;
        }
    };

    const buildDashboard = () => {
        if (document.getElementById("tmaa-dashboard")) return null;

        const dash = document.createElement("div");
        dash.id = "tmaa-dashboard";

        dash.innerHTML = `
            <div class="tmaa-group">
                <label>My Sell Price ($)</label>
                <input type="number" id="tmaa-sell-price" min="0" step="1" placeholder="e.g. 840000">
            </div>
            <div class="tmaa-group">
                <label>Quantity (Optional)</label>
                <input type="number" id="tmaa-qty" min="1" step="1" value="1">
            </div>
            <div class="tmaa-group">
                <label>Base Fee %</label>
                <input type="number" id="tmaa-fee" step="0.01" value="${STATE.feeRate}">
            </div>
            <div class="tmaa-group" style="flex-direction: row; align-items: center; padding-top: 15px;">
                <input type="checkbox" id="tmaa-anon" ${STATE.isAnon ? "checked" : ""}>
                <label style="margin-left: 5px;">Anonymous (+10%)</label>
            </div>
            <div class="tmaa-results">
                <p id="tmaa-rev-display">Gross: $0 | Fee: $0</p>
                <p id="tmaa-break-even-display">Max Buy Price: <span class="highlight">$0</span></p>
            </div>
        `;

        // Event Listeners
        dash.addEventListener("input", (e) => {
            const target = e.target;
            if (target.id === "tmaa-sell-price") STATE.sellPrice = parseInt(target.value) || 0;
            if (target.id === "tmaa-qty") STATE.qty = parseInt(target.value) || 1;
            if (target.id === "tmaa-fee") {
                STATE.feeRate = parseFloat(target.value) || 0;
                GM_setValue("tmaa_feeRate", STATE.feeRate);
            }
            if (target.id === "tmaa-anon") {
                STATE.isAnon = target.checked;
                GM_setValue("tmaa_isAnon", STATE.isAnon);
            }
            calculateArbitrage();
        });

        return dash;
    };

    const highlightMarketListings = (breakEvenPrice) => {
        if (breakEvenPrice <= 0) return;

        // Torn's market lists generally use classes like .item-list > li or div rows
        // We look for elements that contain a price identifier.
        const listItems = document.querySelectorAll("ul[class*='itemList'] > li, div[class*='market-item'], ul.items-list > li");
        
        listItems.forEach(row => {
            // Find the element containing the price text. Usually a div with class containing 'price' or 'cost'
            const priceEl = row.querySelector("[class*='price'], [class*='cost']");
            if (!priceEl) return;

            // Extract integers from string (e.g. "$840,000" -> 840000)
            const priceText = priceEl.textContent.replace(/[^0-9]/g, '');
            if (!priceText) return;

            const listPrice = parseInt(priceText, 10);

            if (listPrice < breakEvenPrice) {
                row.classList.add("tmaa-profit-row");
            } else {
                row.classList.remove("tmaa-profit-row");
            }
        });
    };

    // --- OBSERVER ---
    const initObserver = () => {
        const observer = new MutationObserver((mutations) => {
            // 1. Ensure Dashboard is injected
            const marketWrap = document.querySelector(".market-wrapper, #item-market-main-wrap, div[class^='itemMarket']");
            if (marketWrap && !document.getElementById("tmaa-dashboard")) {
                marketWrap.prepend(buildDashboard());
            }

            // 2. Re-calculate and highlight if DOM changed (React re-renders list)
            const totalFeePercent = STATE.feeRate + (STATE.isAnon ? 10.0 : 0.0);
            const breakEvenPrice = STATE.sellPrice * (1 - (totalFeePercent / 100));
            highlightMarketListings(breakEvenPrice);
        });

        observer.observe(document.body, { childList: true, subtree: true });
    };

    // --- SUPPORT MODULE (Integrated) ---
    class SupportModule {
        constructor(config = {}) {
            this.bmcId = config.bmcId || "bittick1c";
            this.tornUserId = config.tornUserId || "2954173";
            this.xanaxItemId = 206; 
            
            this.init();
        }

        init() {
            if (document.getElementById('thawookie-support-module')) return;
            this.injectStyles();
            this.injectUI();
        }

        injectStyles() {
            const styles = `
                #thawookie-support-module {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    z-index: 999999;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    font-family: Arial, sans-serif;
                }
                .tw-support-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 10px 15px;
                    background-color: #333;
                    color: #fff !important;
                    text-decoration: none !important;
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: bold;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                    transition: transform 0.2s ease, background-color 0.2s ease;
                    border: 1px solid #555;
                    cursor: pointer;
                }
                .tw-support-btn:active {
                    transform: scale(0.95);
                }
                .tw-bmc { background-color: #FFDD00; color: #000 !important; border-color: #FFDD00; }
                .tw-torn-tip { background-color: #8ab63d; border-color: #6a8c2f; }
            `;
            if (typeof GM_addStyle !== "undefined") {
                GM_addStyle(styles);
            } else {
                const styleNode = document.createElement('style');
                styleNode.innerHTML = styles;
                document.head.appendChild(styleNode);
            }
        }

        injectUI() {
            const container = document.createElement('div');
            container.id = 'thawookie-support-module';

            const bmcLink = document.createElement('a');
            bmcLink.href = `https://www.buymeacoffee.com/${this.bmcId}`;
            bmcLink.target = "_blank";
            bmcLink.rel = "noopener noreferrer";
            bmcLink.className = "tw-support-btn tw-bmc";
            bmcLink.innerHTML = `☕ Buy Me a Coffee`;

            const tipLink = document.createElement('a');
            tipLink.href = `https://www.torn.com/item.php`;
            tipLink.target = "_blank";
            tipLink.rel = "noopener noreferrer";
            tipLink.className = "tw-support-btn tw-torn-tip";
            tipLink.title = `Opens Items — search "Xanax", tap Send, enter ThaWookie [${this.tornUserId}]`;
            tipLink.innerHTML = `💊 Send a Xanax Tip`;

            container.appendChild(bmcLink);
            container.appendChild(tipLink);
            document.body.appendChild(container);
        }
    }

    // --- INITIALIZATION ---
    const init = () => {
        injectStyles();
        initObserver();
        new SupportModule();
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})();