<div style="background: #15191f; padding: 24px; border-radius: 10px; color: #dce3ec; font-family: Arial, sans-serif; line-height: 1.7; border: 1px solid #ecc022;">

<h1 style="color: #ecc022; text-align: center; border-bottom: 2px solid #39424e; padding-bottom: 16px;">
    📈 Torn Market Arbitrage Assistant
</h1>

<p style="text-align: center;">
    <strong>TMAA · Version 1.0.1</strong><br>
    By <a href="https://www.torn.com/profiles.php?XID=2954173" target="_blank" rel="noopener noreferrer" style="color: #83e0a6;">ThaWookie [2954173]</a>
    · BSD-3-Clause
</p>

<p style="font-size: 18px; text-align: center; color: #ffffff;">
    <strong>Spot the opportunity. Count the costs. Know your buy limit.</strong>
</p>

<p style="text-align: center; color: #b9c5d5;">
    A cheap listing is only the beginning. TMAA helps you work out whether the
    resale still makes sense after fees, competing listings, quantity limits,
    and your own profit requirements.
</p>

<p>
    <strong>Torn Market Arbitrage Assistant</strong> turns item-market quotes
    into practical purchase plans. Find price gaps, evaluate a trader’s offer,
    compare items on your watchlist, or check a shop sell-back opportunity.
    See the proposed quantity, purchase cost, estimated net profit, and return
    on investment before committing your Torn cash.
</p>

<p>
    You set the assumptions. TMAA does the arithmetic.
    You review the listings and make the purchase in Torn.
</p>

<hr style="border: 0; border-top: 1px solid #39424e; margin: 24px 0;">

<h2 style="color: #ecc022;">✨ What TMAA Does</h2>

<ul>
    <li><strong>Finds item-market price gaps:</strong> Identifies feasible plans to buy the cheaper returned price tiers and estimate a resale below the next tier.</li>
    <li><strong>Evaluates your resale price:</strong> Enter a buyer’s offer or your own target and see which purchases meet your requirements.</li>
    <li><strong>Calculates actual purchase costs:</strong> Uses listing prices and available quantities, rather than treating every unit as equally priced.</li>
    <li><strong>Accounts for selling costs:</strong> Includes market sales fees, optional anonymous fees, and a configurable reserve.</li>
    <li><strong>Shows net profit and ROI:</strong> Compare the estimated return against the cash required.</li>
    <li><strong>Builds a budgeted plan:</strong> Shares your budget and quantity cap across all selected price tiers for that item.</li>
    <li><strong>Enforces both profit thresholds:</strong> Every selected unit must satisfy your minimum dollar profit and minimum ROI.</li>
    <li><strong>Shows your maximum buy price:</strong> See the ceiling that still meets your chosen profit requirements.</li>
    <li><strong>Highlights supported seller rows:</strong> Matching opportunities receive an estimated per-unit profit label on Torn’s market page.</li>
    <li><strong>Provides an independent quote table:</strong> Review prices and plans even when native-row highlighting cannot attach to Torn’s current layout.</li>
    <li><strong>Scans a watchlist:</strong> Compare up to 100 selected items, with results ranked by estimated profit.</li>
    <li><strong>Exports your results:</strong> Download a CSV for further review in a spreadsheet.</li>
</ul>

<h2 style="color: #ecc022;">🎯 Four Ways to Evaluate a Trade</h2>

<table style="width: 100%; border-collapse: collapse;">
    <thead>
        <tr>
            <th scope="col">Strategy</th>
            <th scope="col">How it works</th>
            <th scope="col">When to use it</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>Buy price gap</strong></td>
            <td>Examines cheaper price tiers and estimates a resale below the next tier, applying your undercut, safety discount, fees, and optional market-value cap.</td>
            <td>Looking for an unusually cheap group of listings.</td>
        </tr>
        <tr>
            <td><strong>Manual resale price</strong></td>
            <td>Uses the exact per-item resale price you enter.</td>
            <td>Evaluating an agreed trader offer or a price you have independently researched.</td>
        </tr>
        <tr>
            <td><strong>Market value estimate</strong></td>
            <td>Uses Torn’s returned average price, reduced by your estimate safety discount.</td>
            <td>Screening potential flips against a reference value.</td>
        </tr>
        <tr>
            <td><strong>NPC sell-back</strong></td>
            <td>Uses a available Torn shop sell-back reference from the item catalog, where one exists.</td>
            <td>Checking whether a market listing is below a shop’s sell-back reference.</td>
        </tr>
    </tbody>
</table>

<p style="background: #222a36; border-left: 4px solid #83e0a6; padding: 12px;">
    <strong>The complete-gap check:</strong>
    A price-gap plan must be able to buy every cheaper returned tier included
    in that plan. If your budget or quantity cap leaves part of a cheaper tier
    behind, TMAA rejects that gap instead of pretending the competing stock
    has disappeared.
</p>

<p>
    Market prices and averages are resale references, not guaranteed buyer
    offers. For NPC sell-back, check the relevant shop and your eligibility
    before buying.
</p>

<h2 style="color: #ecc022;">💰 Choose Where You Intend to Sell</h2>

<ul>
    <li><strong>Item market:</strong> Applies your configured sales fee and, when enabled, the additional anonymous fee.</li>
    <li><strong>My bazaar:</strong> Uses a 0% market sales-fee assumption. Your configured reserve still applies.</li>
    <li><strong>Agreed trade:</strong> Uses a 0% market sales-fee assumption for a trade you arrange yourself. Your reserve still applies.</li>
</ul>

<p>
    NPC sell-back calculations do not apply item-market sales fees.
    The bazaar and trade choices specify your planned resale venue;
    they do not automatically search every bazaar or find a buyer.
</p>

<hr style="border: 0; border-top: 1px solid #39424e; margin: 24px 0;">

<h2 style="color: #ecc022;">🚀 Installation &amp; First Scan</h2>

<ol>
    <li><strong>Install TMAA</strong> in your userscript manager, or import it into TornPDA’s userscript feature. When updating, keep only one enabled copy.</li>
    <li><strong>Open Torn’s Item Market.</strong> The dashboard appears alongside the market interface.</li>
    <li><strong>Open “Settings, API key &amp; support.”</strong> Enter your 16-character Torn API key and press <strong>Save key</strong>.</li>
    <li><strong>Use a Public key</strong>, or a custom key allowing <code>market → itemmarket</code> and <code>torn → items</code>.</li>
    <li><strong>Select an item.</strong> Enter its ID, choose a catalog suggestion, or enter an exact item name after the catalog loads. Press <strong>Select item</strong>.</li>
    <li><strong>Choose your strategy and resale venue.</strong> Set your budget, maximum quantity, and profit requirements.</li>
    <li><strong>Press “Refresh quotes.”</strong> Review the proposed purchases, source timestamp, estimated profit, and ROI.</li>
    <li><strong>Use “Open item market ↗”</strong> to inspect availability and make any purchase through Torn.</li>
</ol>

<p>
    Item-specific market URLs can also select and fetch the corresponding
    item automatically when a key is available and no scan is already running.
    Watchlist scans are started by you; TMAA is not a continuously polling
    background scanner.
</p>

<h2 style="color: #ecc022;">🧮 Understand the Results</h2>

<p>The dashboard brings the important numbers together:</p>

<ul>
    <li><strong>Resale per unit:</strong> The price assumed by your selected strategy.</li>
    <li><strong>Net per unit:</strong> Resale proceeds after the applicable fee and reserve.</li>
    <li><strong>Maximum buy price:</strong> The highest purchase price that meets your profit thresholds.</li>
    <li><strong>Plan quantity and cost:</strong> The proposed units and total cash required.</li>
    <li><strong>Resale gross, fees, and reserve:</strong> A breakdown of the estimate.</li>
    <li><strong>Estimated net profit and ROI:</strong> The remaining return after purchase costs.</li>
    <li><strong>Quote table:</strong> Buy price, available quantity, planned quantity, estimated profit per unit, and estimated ROI.</li>
    <li><strong>Quote timestamp and depth:</strong> When the source snapshot was generated, how many rows were returned, and whether depth is partial.</li>
</ul>

<blockquote style="border-left: 4px solid #ecc022; padding-left: 14px;">
    <p><strong>Estimated net profit = resale revenue − sales fees − reserve − purchase cost.</strong></p>
    <p><strong>ROI = estimated net profit ÷ purchase cost × 100.</strong></p>
</blockquote>

<p>
    Fees and reserves round up per unit to avoid optimistic estimates.
    A break-even purchase does not qualify as a profitable opportunity,
    even if the minimum-profit setting is zero.
</p>

<p>
    <strong>Manual calculator:</strong> Manual resale mode also shows a
    standalone proceeds and break-even calculation without requiring fetched
    quotes. Its proceeds figure excludes purchase costs; it is not itself
    the profit from a completed trade.
</p>

<h3 style="color: #83e0a6;">A Small Example</h3>

<p>
    Suppose the returned listings contain <strong>2 units at $800</strong>,
    <strong>3 units at $850</strong>, and the next tier at
    <strong>$1,000</strong>. With a $1 undercut, a 2% safety discount,
    a $1,000 market-value cap, and a 5% market fee:
</p>

<ul>
    <li>The estimated resale price is <strong>$979 per unit</strong>.</li>
    <li>The conservatively rounded fee is <strong>$49 per unit</strong>.</li>
    <li>Buying the five cheaper units costs <strong>$4,150</strong>.</li>
    <li>Estimated net profit is <strong>$500</strong>, or approximately <strong>12.05% ROI</strong>.</li>
</ul>

<p>
    If your budget cannot cover all five cheaper units, that complete-gap
    plan does not qualify. The example also assumes the items subsequently
    sell at the estimated resale price.
</p>

<hr style="border: 0; border-top: 1px solid #39424e; margin: 24px 0;">

<h2 style="color: #ecc022;">⚙️ Every Setting Explained</h2>

<p>
    These are the fresh-install defaults in v1.0.1.
    Existing saved settings can change the values you see.
</p>

<table style="width: 100%; border-collapse: collapse;">
    <thead>
        <tr>
            <th scope="col">Setting</th>
            <th scope="col">Default</th>
            <th scope="col">Purpose</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>Resale strategy</strong></td>
            <td>Buy price gap</td>
            <td>Choose gap, manual, market-value, or NPC analysis.</td>
        </tr>
        <tr>
            <td><strong>Sell through</strong></td>
            <td>Item market</td>
            <td>Choose the resale venue used for market-fee calculations.</td>
        </tr>
        <tr>
            <td><strong>Manual sell price / item</strong></td>
            <td>$0</td>
            <td>Your resale target in manual mode. A zero target produces no purchase plan.</td>
        </tr>
        <tr>
            <td><strong>Maximum total quantity</strong></td>
            <td>1,000</td>
            <td>Caps the entire item plan, not each listing. Range: 1–1,000,000.</td>
        </tr>
        <tr>
            <td><strong>Budget / item</strong></td>
            <td>$10,000,000</td>
            <td>Caps total purchase spending for that item. Set 0 for no budget cap.</td>
        </tr>
        <tr>
            <td><strong>Market sales fee</strong></td>
            <td>5%</td>
            <td>Base fee for item-market resale. Configurable from 0–50%.</td>
        </tr>
        <tr>
            <td><strong>Sell anonymously</strong></td>
            <td>Off</td>
            <td>Adds the configured anonymous fee to item-market resale calculations.</td>
        </tr>
        <tr>
            <td><strong>Anonymous extra fee</strong></td>
            <td>10%</td>
            <td>Configurable from 0–50%. Set 0 if your applicable company perk waives it.</td>
        </tr>
        <tr>
            <td><strong>Cost/risk reserve</strong></td>
            <td>0%</td>
            <td>Deducts an additional 0–50% of resale revenue from the estimate.</td>
        </tr>
        <tr>
            <td><strong>Minimum profit / unit</strong></td>
            <td>$1</td>
            <td>Required dollar profit for every purchased unit. Purchases must always remain strictly profitable.</td>
        </tr>
        <tr>
            <td><strong>Minimum ROI</strong></td>
            <td>1%</td>
            <td>Required percentage return for every purchased unit. Range: 0–10,000%.</td>
        </tr>
        <tr>
            <td><strong>Estimate safety discount</strong></td>
            <td>2%</td>
            <td>Reduces gap and market-value resale estimates. Range: 0–90%. Does not reduce your manual price or NPC reference.</td>
        </tr>
        <tr>
            <td><strong>Gap undercut</strong></td>
            <td>$1</td>
            <td>Subtracts this amount from the gap benchmark before the safety discount.</td>
        </tr>
        <tr>
            <td><strong>Cap gap target at market value</strong></td>
            <td>On</td>
            <td>Uses the lower of the next price tier and returned market value as the gap benchmark.</td>
        </tr>
        <tr>
            <td><strong>Highlight matching seller rows</strong></td>
            <td>On</td>
            <td>Adds profit marking to supported native seller rows.</td>
        </tr>
        <tr>
            <td><strong>Maximum pages / item</strong></td>
            <td>3</td>
            <td>Fetches up to the selected number of pages, with up to 100 rows per request. Range: 1–5 pages.</td>
        </tr>
        <tr>
            <td><strong>Quote expires after seconds</strong></td>
            <td>120</td>
            <td>Stops using quotes older than your chosen source age. Range: 30–600 seconds.</td>
        </tr>
    </tbody>
</table>

<p>
    Dollar inputs support whole-dollar values up to $100,000,000,000.
    Unsupported values are rejected. Budgets and quantity limits apply
    together: the first limit reached constrains the plan.
</p>

<h2 style="color: #ecc022;">💾 Save Different Targets for Different Items</h2>

<p>
    A single resale assumption does not suit every item. Configure the
    selected item, then choose <strong>Save target for this item</strong>
    to retain its:
</p>

<ul>
    <li>Resale strategy.</li>
    <li>Resale venue.</li>
    <li>Manual per-item resale price.</li>
</ul>

<p>
    Changes to those fields for a selected item remain temporary until saved.
    Choose <strong>Use global defaults</strong> to remove that item’s saved
    target and temporary edits. Budget, quantity, fees, and other general
    controls remain shared settings.
</p>

<h2 style="color: #ecc022;">⭐ Build Your Watchlist</h2>

<ul>
    <li><strong>★ Add to watchlist:</strong> Add the selected item.</li>
    <li><strong>Add visible category items:</strong> Add identifiable items currently rendered in the market category. This does not automatically collect every item in Torn.</li>
    <li><strong>Scan watchlist:</strong> Fetch and assess the saved list using each item’s applicable resale assumptions.</li>
    <li><strong>Stop scan:</strong> Cancel an active scan while retaining completed results.</li>
    <li><strong>View:</strong> Show an item’s available analysis in the main dashboard.</li>
    <li><strong>Remove:</strong> Remove an item from the watchlist.</li>
    <li><strong>Export scan CSV:</strong> Export the watchlist’s current results for spreadsheet review.</li>
</ul>

<p>
    Results include estimated profit, ROI, planned quantity, and quote or
    error information. Higher estimated-profit plans appear first.
    Each item receives its own budget calculation: do not add every plan
    together and assume the combined purchases fit one shared cash balance.
</p>

<p>
    Keep the market tab visible while scanning. Hiding the page or navigating
    away stops the active scan; start another scan when you are ready.
    API pacing means larger watchlists take longer.
</p>

<p>
    CSV exports include item identity, strategy, venue, quote time, partial-depth
    status, quantity, cost, resale price, fees, reserve, estimated profit, ROI,
    and result notes. API keys are excluded, and text is escaped to reduce
    spreadsheet-formula interpretation.
</p>

<hr style="border: 0; border-top: 1px solid #39424e; margin: 24px 0;">

<h2 style="color: #ecc022;">🔄 Quotes, Caching &amp; Page Recovery</h2>

<ul>
    <li><strong>Source timestamps:</strong> Quote age uses the API’s cache timestamp, rather than treating receipt time as proof of freshness.</li>
    <li><strong>Quote expiration:</strong> Expired quotes stop producing purchase plans and profit highlights.</li>
    <li><strong>Bounded pagination:</strong> The configured page limit controls how much listing depth is requested.</li>
    <li><strong>Consistent snapshots:</strong> Pages with different source timestamps are not merged into one plan.</li>
    <li><strong>Partial-depth labels:</strong> Results indicate when additional listings may exist or pagination could not be completed consistently.</li>
    <li><strong>Catalog caching:</strong> Item metadata is cached locally for 24 hours. Use <strong>Reload item catalog</strong> to request an update.</li>
    <li><strong>Market quote reuse:</strong> Recently fetched snapshots can be reused. Refreshing does not bypass Torn’s global cache.</li>
    <li><strong>React recovery:</strong> The dashboard is designed to reattach when Torn replaces its market interface.</li>
    <li><strong>Dynamic price handling:</strong> Relevant price-text and item-identity changes trigger another highlighting check.</li>
    <li><strong>Clean highlight removal:</strong> Invalid targets, expired quotes, changed prices, and leaving the market remove applicable profit marking.</li>
</ul>

<h2 style="color: #ecc022;">🔐 API Use &amp; Your Data</h2>

<p>
    TMAA requests the item catalog and item-market listings from
    <strong>api.torn.com</strong>. It does not need your Torn password.
</p>

<ul>
    <li><strong>Public access is sufficient:</strong> Use a Public key or a custom key allowing the two required selections.</li>
    <li><strong>Keys stay out of URLs:</strong> Authentication uses a request header.</li>
    <li><strong>Local key handling:</strong> A saved key uses userscript-manager storage. If that storage is unavailable, the key remains in memory for the current page.</li>
    <li><strong>Forget key:</strong> Removes the key from supported storage and clears the current quote results.</li>
    <li><strong>Local preferences:</strong> Settings, saved targets, watchlists, and catalog data stay on your device through supported storage.</li>
    <li><strong>No automatic reporting to the author:</strong> The script does not send your key, settings, or logs to the developer.</li>
    <li><strong>Paced requests:</strong> TMAA spaces its request starts by at least 4.1 seconds and applies a 15-request rolling-minute budget.</li>
    <li><strong>Tab coordination:</strong> Web Locks are used where available, with a single-owner lease fallback for older environments.</li>
    <li><strong>Error handling:</strong> Rate-limit responses pause requests; key-related errors stop further API work until addressed. Supported temporary failures receive bounded retries.</li>
    <li><strong>Compatibility paths:</strong> Legacy GM, modern GM, and standard Web API fallbacks are included.</li>
</ul>

<p>
    Other scripts and applications share Torn’s API allowance.
    TMAA’s own request budget cannot guarantee how much of that allowance
    remains available to your account.
</p>

<hr style="border: 0; border-top: 1px solid #39424e; margin: 24px 0;">

<h2 style="color: #ecc022;">🪲 Built-In Debugger &amp; Troubleshooting</h2>

<p>
    If a scan fails or something looks wrong, open
    <strong>Settings, API key &amp; support</strong> and press
    <strong>🪲</strong>. The integrated modular debugger records useful
    operation information, including API request outcomes, scan failures,
    and storage problems.
</p>

<ul>
    <li><strong>🪲:</strong> Show or hide the diagnostic panel.</li>
    <li><strong>📋 Copy Logs to Clipboard:</strong> Copy available logs directly from Settings.</li>
    <li><strong>Copy:</strong> Copy logs from inside the debugger panel.</li>
    <li><strong>Clear:</strong> Clear the current log buffer.</li>
    <li><strong>Hide:</strong> Close the panel without removing the script.</li>
</ul>

<p>
    The debugger bounds retained logs, limits visible log rendering, and
    redacts key-shaped strings. Raw API responses are not intentionally
    recorded. Review copied logs before sharing them, and never include
    your API key in a bug report.
</p>

<table style="width: 100%; border-collapse: collapse;">
    <thead>
        <tr>
            <th scope="col">What you see</th>
            <th scope="col">What to check</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><strong>No qualifying opportunity</strong></td>
            <td>Check the resale price, fees, reserve, profit thresholds, budget, and quantity cap. There may simply be no suitable trade.</td>
        </tr>
        <tr>
            <td><strong>A gap exists, but no plan appears</strong></td>
            <td>Confirm you can afford every cheaper returned tier. Check the market-value cap and safety discount.</td>
        </tr>
        <tr>
            <td><strong>Quote expired</strong></td>
            <td>Refresh the item. Torn’s global cache may still return an older snapshot.</td>
        </tr>
        <tr>
            <td><strong>API stopped or invalid key</strong></td>
            <td>Check the key’s status and required permissions, then save it again.</td>
        </tr>
        <tr>
            <td><strong>No green seller rows</strong></td>
            <td>Check the highlight setting and quote freshness. The independent quote table can still be used when native selectors do not match.</td>
        </tr>
        <tr>
            <td><strong>Equipment excluded</strong></td>
            <td>Weapons, armor, and unique-detail listings require individual valuation because stats and bonuses affect their price.</td>
        </tr>
    </tbody>
</table>

<p>
    For a useful bug report, include the script version, browser or TornPDA
    version, item ID, selected strategy, expected result, actual result,
    and relevant debugger logs.
</p>

<h2 style="color: #ecc022;">📱 Compatibility &amp; Scope</h2>

<p>
    TMAA includes responsive controls, touch-friendly interactions,
    clipboard fallbacks, and reduced-motion support for its donation
    animations. Version 1.0.1 passed syntax validation and
    <strong>128 automated checks</strong> using simulated API responses
    and DOM environments. Live Torn and real-device TornPDA verification
    remain outstanding.
</p>

<p>
    TMAA evaluates returned item-market listings. It does not automatically
    buy or sell, guarantee a resale, provide a complete bazaar price index,
    or predict how quickly stock will move. Listings can disappear, sellers
    can be inaccessible, and your own listings may not be distinguishable
    in a public snapshot. Review the current market before committing cash.
</p>

<hr style="border: 0; border-top: 1px solid #39424e; margin: 24px 0;">

<h2 style="color: #ecc022;">💖 Help Keep TMAA Improving</h2>

<p>
    <strong>Did TMAA help you spot a worthwhile flip—or avoid an expensive mistake?</strong>
    If it earns a place in your trading routine, consider sending a little
    support to the person maintaining it.
</p>

<p>
    Tips are optional and do not unlock features. Using the script,
    sharing it with another trader, and reporting reproducible bugs
    are also appreciated.
</p>

<p>
    Inside Settings, you will find the animated
    <strong>Buy Me a Coffee</strong> button: a hopping cup, rising steam,
    animated coffee fill, a sweeping gleam, and an alternating label.
    Reduced-motion preferences are respected.
    The same support destinations are available below.
</p>

<p style="text-align: center;">
    <a href="https://www.buymeacoffee.com/bittick1c" target="_blank" rel="noopener noreferrer" style="color: #FFDD00;">☕ Support the project</a>
    &nbsp;·&nbsp;
    <a href="https://www.torn.com/item.php" target="_blank" rel="noopener noreferrer" style="color: #83e0a6;">💊 Open Items to send a Xanax tip</a>
</p>
<br>
<p style="text-align: center;">
    <a href="https://www.torn.com/profiles.php?XID=2954173"
       target="_blank"
       rel="noopener noreferrer"
       style="color: #83e0a6;">
        View ThaWookie’s Torn profile
    </a>
</p>

<hr style="border: 0; border-top: 1px solid #39424e; margin: 24px 0;">

<p style="text-align: center;">
    <strong style="color: #ecc022;">Find the gap. Check the numbers. Trade with a plan.</strong>
</p>

<p style="text-align: center; color: #b9c5d5;">
    Created by ShavedW00kie — ThaWookie [2954173].<br>
    Licensed under BSD-3-Clause. Redistribution and modification are permitted
    subject to the license conditions included with the script.
</p>

</div>
