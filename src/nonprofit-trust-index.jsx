import { useState, useMemo } from "react";

/* ============================================================
   THE LEDGER — Nonprofit Trust Index
   Live mode: ProPublica Nonprofit Explorer API (free, no key)
   Demo mode: fictional archetypes for tuning the algorithm
   NOTE: claude.ai's artifact sandbox blocks external network
   calls, so live mode may fail here — deploy this file on your
   own site (or behind a tiny proxy) and it works. Set API_BASE
   to your proxy if ProPublica's CORS policy blocks the browser.
   ============================================================ */

const API_BASE = "https://projects.propublica.org/nonprofits/api/v2";

/* ---------------- demo data (fictional) ---------------- */
const DEMO_ORGS = [
  { id: 1, name: "Lakeshore Food Bank", ein: "36-2214870", type: "operating",
    mission: "Distributes 14M lbs of food annually across Cook County",
    revenue: 18400000, totalExpenses: 17600000, programExpenses: 15900000,
    fundraisingCosts: 610000, contributionsRaised: 12200000,
    ceoComp: 168000, employees: 142, auditedFinancials: true, filedOnTime: true },
  { id: 2, name: "Harborlight Relief Fund", ein: "82-4471903", type: "operating",
    mission: "Disaster response and temporary housing in the Great Lakes region",
    revenue: 42100000, totalExpenses: 39800000, programExpenses: 33800000,
    fundraisingCosts: 5600000, contributionsRaised: 31000000,
    ceoComp: 295000, employees: 310, auditedFinancials: true, filedOnTime: true },
  { id: 3, name: "Open Prairie Trust", ein: "47-8810245", type: "foundation",
    mission: "Grantmaking foundation funding rural education programs",
    revenue: 96000000, totalExpenses: 8900000, programExpenses: 7800000,
    fundraisingCosts: 0, contributionsRaised: 0, assets: 1240000000,
    payoutRate: 5.8, ceoComp: 410000, employees: 11,
    auditedFinancials: true, filedOnTime: true },
  { id: 4, name: "Midwest Children's Health Alliance", ein: "31-5529064", type: "operating",
    mission: "Pediatric care access and screening clinics in five states",
    revenue: 27300000, totalExpenses: 26100000, programExpenses: 19800000,
    fundraisingCosts: 3100000, contributionsRaised: 17500000,
    ceoComp: 340000, employees: 205, auditedFinancials: true, filedOnTime: true },
  { id: 5, name: "Beacon Arts Endowment", ein: "58-3306718", type: "foundation",
    mission: "Endowed foundation supporting regional performing arts",
    revenue: 22000000, totalExpenses: 3400000, programExpenses: 2700000,
    fundraisingCosts: 0, contributionsRaised: 0, assets: 310000000,
    payoutRate: 3.9, ceoComp: 385000, employees: 8,
    auditedFinancials: true, filedOnTime: false },
  { id: 6, name: "The Ashford Foundation", ein: "88-1174632", type: "foundation",
    mission: "Private family foundation; stated focus on science and education",
    revenue: 310000000, totalExpenses: 6200000, programExpenses: 4900000,
    fundraisingCosts: 0, contributionsRaised: 0, assets: 7100000000,
    payoutRate: 2.1, ceoComp: 0, employees: 4,
    auditedFinancials: false, filedOnTime: false },
  { id: 7, name: "Veterans Promise Network", ein: "20-9938471", type: "operating",
    mission: "Awareness campaigns and benefit navigation for veterans",
    revenue: 9800000, totalExpenses: 9500000, programExpenses: 4600000,
    fundraisingCosts: 3700000, contributionsRaised: 8900000,
    ceoComp: 425000, employees: 38, auditedFinancials: false, filedOnTime: true },
  { id: 8, name: "National Awareness Coalition", ein: "45-6620158", type: "operating",
    mission: "Public education campaigns on consumer health topics",
    revenue: 14200000, totalExpenses: 13900000, programExpenses: 7100000,
    fundraisingCosts: 4200000, contributionsRaised: 12800000,
    ceoComp: 890000, employees: 52, auditedFinancials: false, filedOnTime: false },
];

/* ---------------- shared helpers ---------------- */
function fmt(n) {
  if (n == null || isNaN(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(0) + "K";
  return String(Math.round(n));
}
const grade = (s) => (s >= 8.5 ? "STRONG" : s >= 6.5 ? "FAIR" : s >= 4.5 ? "WEAK" : "FLAGGED");
const finding = (label, points, detail, ok, na) => ({
  label, points: Math.round(points * 100) / 100, detail, ok, na: !!na,
});

/* ---------------- demo scoring ---------------- */
function scoreDemoOrg(o) {
  const f = [];
  const pr = o.programExpenses / o.totalExpenses;
  f.push(pr >= 0.75
    ? finding("Program spending", 0, `${(pr * 100).toFixed(0)}% of expenses go to programs (>=75% benchmark)`, true)
    : finding("Program spending", Math.min(3, (0.75 - pr) * 12),
        `Only ${(pr * 100).toFixed(0)}% of expenses reach programs (benchmark 75%)`, false));

  if (o.type === "foundation") {
    f.push(o.payoutRate >= 5
      ? finding("Asset payout", 0, `Distributes ${o.payoutRate}% of assets (meets 5% IRS minimum)`, true)
      : finding("Asset payout", Math.min(4.5, (5 - o.payoutRate) * 1.4),
          `Distributes only ${o.payoutRate}% of assets — below the 5% IRS minimum`, false));
  } else {
    const fe = o.contributionsRaised > 0 ? o.fundraisingCosts / o.contributionsRaised : 0;
    f.push(fe <= 0.15
      ? finding("Fundraising cost", 0, `$${fe.toFixed(2)} spent per $1 raised (<=$0.15 benchmark)`, true)
      : finding("Fundraising cost", Math.min(2.5, (fe - 0.15) * 9),
          `$${fe.toFixed(2)} spent to raise each $1 (benchmark $0.15)`, false));
  }

  const cr = o.ceoComp / o.totalExpenses;
  if (o.ceoComp === 0) f.push(finding("Executive pay", 0, "No compensated executive reported", true));
  else if (cr <= 0.02 && o.ceoComp < 600000)
    f.push(finding("Executive pay", 0, `Top pay $${fmt(o.ceoComp)} — ${(cr * 100).toFixed(1)}% of expenses`, true));
  else f.push(finding("Executive pay", Math.min(2, (cr - 0.02) * 30 + (o.ceoComp > 600000 ? 0.5 : 0)),
      `Top pay $${fmt(o.ceoComp)} is ${(cr * 100).toFixed(1)}% of total expenses`, false));

  f.push(o.auditedFinancials
    ? finding("Independent audit", 0, "Audited financial statements on file", true)
    : finding("Independent audit", 0.75, "No independent audit reported", false));
  f.push(o.filedOnTime
    ? finding("Filing history", 0, "Form 990 filed on time", true)
    : finding("Filing history", 0.75, "Late or amended Form 990 filing", false));

  const total = f.reduce((s, x) => s + x.points, 0);
  return { findings: f, score: Math.max(0, Math.round((10 - total) * 10) / 10) };
}

/* ---------------- live scoring (ProPublica summary fields) ----------------
   Available per filing: totrevenue, totfuncexpns, totassetsend,
   totcntrbgfts, compnsatncurrofcr (990 only), formtype (2 = 990-PF),
   tax_prd_yr. NOT in the summary feed: program/fundraising expense
   split, employee count, audit status — those need full e-file data. */
function scoreLiveOrg(filing, isFoundation) {
  const f = [];
  const rev = filing.totrevenue, exp = filing.totfuncexpns, assets = filing.totassetsend;

  if (isFoundation) {
    if (assets > 0 && exp != null) {
      const payout = (exp / assets) * 100;
      f.push(payout >= 5
        ? finding("Asset payout (proxy)", 0,
            `Spending equals ~${payout.toFixed(1)}% of assets — at or above the 5% IRS minimum for foundations`, true)
        : finding("Asset payout (proxy)", Math.min(4.5, (5 - payout) * 1.4),
            `Spending equals only ~${payout.toFixed(1)}% of $${fmt(assets)} in assets (5% IRS minimum). Proxy: total expenses / total assets`, false));
    }
  } else if (rev > 1000000 && exp != null && exp / rev < 0.5) {
    f.push(finding("Money deployed", Math.min(1.5, (0.5 - exp / rev) * 4),
      `Spent only ${((exp / rev) * 100).toFixed(0)}% of the $${fmt(rev)} it took in this year — funds may be accumulating`, false));
  } else if (exp != null && rev != null) {
    f.push(finding("Money deployed", 0,
      `Spent $${fmt(exp)} against $${fmt(rev)} revenue — funds are moving`, true));
  }

  const comp = filing.compnsatncurrofcr;
  if (comp != null && exp > 0) {
    const cr = comp / exp;
    f.push(cr <= 0.05
      ? finding("Officer compensation", 0,
          `$${fmt(comp)} total officer pay — ${(cr * 100).toFixed(1)}% of expenses`, true)
      : finding("Officer compensation", Math.min(2, (cr - 0.05) * 15),
          `$${fmt(comp)} total officer pay is ${(cr * 100).toFixed(1)}% of all spending`, false));
  } else {
    f.push(finding("Officer compensation", 0, "Not reported in this filing's summary data", true, true));
  }

  const yr = filing.tax_prd_yr;
  const age = new Date().getFullYear() - yr;
  f.push(age <= 3
    ? finding("Filing recency", 0, `Most recent data is from tax year ${yr}`, true)
    : finding("Filing recency", Math.min(1.5, (age - 3) * 0.5),
        `Newest extracted filing is from ${yr} — ${age} years old`, false));

  f.push(finding("Program expense split", 0,
    "Not in the IRS summary feed — requires full 990 e-file data (next build step)", true, true));
  f.push(finding("Fundraising efficiency", 0,
    "Not in the IRS summary feed — requires full 990 e-file data (next build step)", true, true));

  const total = f.reduce((s, x) => s + x.points, 0);
  return { findings: f, score: Math.max(0, Math.round((10 - total) * 10) / 10) };
}

/* ---------------- live API helpers ----------------
   Strategy: try fetching ProPublica directly (works when this
   file is deployed on your own site). If the sandbox blocks it,
   fall back to relaying the request through the Anthropic API
   with web access enabled — slower (~10-20s) but works inside
   the claude.ai preview. */
async function claudeBridge(url, shape) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `Fetch this exact URL: ${url}\nIt returns JSON from ProPublica's Nonprofit Explorer API (public IRS data). From what it returns, respond with ONLY valid JSON matching this exact shape — no markdown fences, no commentary, no extra fields:\n${shape}\nIf the URL cannot be retrieved, respond with exactly: {"error":"unreachable"}`,
      }],
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    }),
  });
  if (!r.ok) throw new Error(`Bridge request failed (HTTP ${r.status})`);
  const data = await r.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const clean = text.replace(/```json|```/g, "").trim();
  const s = clean.indexOf("{"), e = clean.lastIndexOf("}");
  if (s < 0 || e < 0) throw new Error("Bridge returned no readable data");
  const parsed = JSON.parse(clean.slice(s, e + 1));
  if (parsed.error) throw new Error("The IRS data feed couldn't be reached via web access either");
  return parsed;
}

async function apiSearch(q) {
  const url = `${API_BASE}/search.json?q=${encodeURIComponent(q)}`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    return { orgs: d.organizations || [], via: "direct" };
  } catch {
    const d = await claudeBridge(url,
      `{"organizations":[{"name":"string","ein":123456789,"city":"string","state":"XX"}]}\nInclude at most the first 10 organizations from the response.`);
    return { orgs: d.organizations || [], via: "bridge" };
  }
}

async function apiOrg(ein) {
  const url = `${API_BASE}/organizations/${ein}.json`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch {
    const d = await claudeBridge(url,
      `{"organization":{"name":"string","ein":123456789,"city":"string","state":"XX"},"filing":{"tax_prd_yr":2023,"formtype":0,"totrevenue":0,"totfuncexpns":0,"totassetsend":0,"totcntrbgfts":0,"compnsatncurrofcr":null,"pdf_url":null}}\nUse the single most recent entry in filings_with_data (highest tax_prd_yr). Numbers must be plain numbers. If filings_with_data is empty, set "filing" to null.`);
    return { organization: d.organization, filings_with_data: d.filing ? [d.filing] : [] };
  }
}
const einFmt = (e) => { const s = String(e).padStart(9, "0"); return s.slice(0, 2) + "-" + s.slice(2); };

/* ================= UI ================= */
export default function TrustLedger() {
  const [mode, setMode] = useState("demo");
  return (
    <div className="tl-root">
      <style>{css}</style>
      <header className="tl-head">
        <div className="tl-eyebrow">FORM 990 · PUBLIC DISCLOSURE ANALYSIS</div>
        <h1>The Ledger</h1>
        <p className="tl-sub">
          Every U.S. nonprofit files its finances with the IRS. We read the filings,
          start each organization at <span className="mono">10.00</span>, and deduct
          for what the numbers show.
        </p>
        <div className="tl-modetoggle">
          <button className={mode === "demo" ? "on" : ""} onClick={() => setMode("demo")}>Demo ledger</button>
          <button className={mode === "live" ? "on" : ""} onClick={() => setMode("live")}>Live IRS data</button>
        </div>
      </header>
      {mode === "demo" ? <DemoMode /> : <LiveMode />}
      <footer className="tl-foot">
        <b>Methodology.</b> Scores derive only from figures organizations report on IRS Form 990.
        Foundations and operating charities are scored on different tracks — a grantmaking
        foundation with few staff is not penalized for headcount; it is measured by whether
        the money actually goes out the door. Live mode uses ProPublica's Nonprofit Explorer
        summary feed; metrics that require the full 990 e-file (program expense split,
        fundraising costs, staff counts) are shown as "not in feed" and never deducted.
      </footer>
    </div>
  );
}

/* ---------------- demo mode ---------------- */
function DemoMode() {
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [openId, setOpenId] = useState(null);

  const rows = useMemo(() => DEMO_ORGS
    .map((o) => ({ ...o, ...scoreDemoOrg(o) }))
    .filter((o) => o.name.toLowerCase().includes(q.toLowerCase()) || o.ein.includes(q))
    .filter((o) => typeFilter === "all" || o.type === typeFilter)
    .sort((a, b) => b.score - a.score), [q, typeFilter]);

  return (
    <>
      <div className="tl-controls">
        <div className="tl-field">
          <label>SEARCH DEMO ORGANIZATIONS</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Harborlight or 82-4471903" />
        </div>
        <div className="tl-toggle">
          {["all", "operating", "foundation"].map((t) => (
            <button key={t} className={typeFilter === t ? "on" : ""} onClick={() => setTypeFilter(t)}>
              {t === "all" ? "All" : t === "operating" ? "Operating charities" : "Foundations"}
            </button>
          ))}
        </div>
      </div>
      <div className="tl-note">Fictional organizations built as archetypes, for tuning the scoring formula.</div>
      <div className="tl-listhead">
        <span>ORGANIZATION</span><span>TYPE</span><span>REVENUE</span><span>STAFF</span><span className="r">SCORE</span>
      </div>
      {rows.length === 0 && <div className="tl-empty">No organizations match. Clear the search to see all eight demo filings.</div>}
      {rows.map((o) => (
        <div key={o.id} className={"tl-row " + (openId === o.id ? "open" : "")}>
          <button className="tl-rowmain" onClick={() => setOpenId(openId === o.id ? null : o.id)}>
            <span className="tl-name">{o.name}<span className="tl-ein mono">EIN {o.ein}</span></span>
            <span className={"tl-type " + o.type}>{o.type === "operating" ? "Operating" : "Foundation"}</span>
            <span className="mono">${fmt(o.revenue)}</span>
            <span className="mono">{o.employees}</span>
            <span className={"tl-score mono r g-" + grade(o.score)}>{o.score.toFixed(1)}</span>
          </button>
          {openId === o.id && (
            <div className="tl-detail">
              <p className="tl-mission">{o.mission}</p>
              <Ledger findings={o.findings} score={o.score} />
              <Stamp score={o.score} />
            </div>
          )}
        </div>
      ))}
    </>
  );
}

/* ---------------- live mode ---------------- */
function LiveMode() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [org, setOrg] = useState(null);
  const [via, setVia] = useState(null);

  async function runSearch() {
    if (!q.trim()) return;
    setBusy(true); setErr(null); setOrg(null); setResults(null);
    try {
      const r = await apiSearch(q.trim());
      setResults(r.orgs); setVia(r.via);
    }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function openOrg(ein) {
    setBusy(true); setErr(null); setOrg(null);
    try {
      const d = await apiOrg(ein);
      const filings = (d.filings_with_data || []).slice().sort((a, b) => b.tax_prd_yr - a.tax_prd_yr);
      const latest = filings[0];
      if (!latest) { setOrg({ info: d.organization, noData: true }); return; }
      const isFoundation = latest.formtype === 2;
      setOrg({ info: d.organization, filing: latest, isFoundation,
        pdf: latest.pdf_url, ...scoreLiveOrg(latest, isFoundation) });
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <>
      <div className="tl-controls">
        <div className="tl-field">
          <label>SEARCH 1.8M REAL NONPROFITS (PROPUBLICA / IRS)</label>
          <input value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="e.g. American Red Cross" />
        </div>
        <button className="tl-go" onClick={runSearch} disabled={busy}>{busy ? "Working…" : "Search filings"}</button>
      </div>
      <div className="tl-note">
        {busy
          ? "Reaching the IRS data feed — inside this preview it routes through Claude's web access, which can take 10–20 seconds."
          : via === "bridge"
          ? "Results fetched via Claude's web access (the preview blocks direct calls). Deployed on your own site, this hits ProPublica directly and is instant."
          : "Searches ProPublica's Nonprofit Explorer — public IRS Form 990 data for ~1.8M organizations."}
      </div>

      {err && (
        <div className="tl-error">
          <b>Couldn't reach the IRS data feed.</b> {err}. Both the direct call and the
          web-access fallback failed — try the search again in a moment. Deployed on
          your own site this file calls ProPublica directly; if the browser reports a
          CORS error there, route requests through a small proxy and point{" "}
          <span className="mono">API_BASE</span> at it.
        </div>
      )}

      {results && !org && (
        <>
          <div className="tl-listhead live"><span>ORGANIZATION</span><span>LOCATION</span><span className="r">EIN</span></div>
          {results.length === 0 && <div className="tl-empty">No filings found for that name. Try fewer words.</div>}
          {results.map((r) => (
            <div key={r.ein} className="tl-row">
              <button className="tl-rowmain live" onClick={() => openOrg(r.ein)}>
                <span className="tl-name">{r.name}</span>
                <span>{r.city ? `${r.city}, ${r.state}` : r.state || "—"}</span>
                <span className="mono r">{einFmt(r.ein)}</span>
              </button>
            </div>
          ))}
        </>
      )}

      {org && (
        <div className="tl-row open">
          <div className="tl-detail standalone">
            <button className="tl-back" onClick={() => setOrg(null)}>← Back to results</button>
            <h2 className="tl-orgname">{org.info.name}</h2>
            <p className="tl-mission mono">
              EIN {einFmt(org.info.ein)} · {org.info.city}, {org.info.state}
              {org.filing && <> · Tax year {org.filing.tax_prd_yr} · {org.isFoundation ? "Private foundation (990-PF)" : "Operating nonprofit (990)"}</>}
            </p>
            {org.noData ? (
              <div className="tl-note">This organization has filings on record, but the IRS hasn't extracted
                machine-readable financials from them yet. Only the PDF forms exist — no score can be computed.</div>
            ) : (
              <>
                <div className="tl-statrow">
                  <div><label>REVENUE</label><span className="mono">${fmt(org.filing.totrevenue)}</span></div>
                  <div><label>EXPENSES</label><span className="mono">${fmt(org.filing.totfuncexpns)}</span></div>
                  <div><label>ASSETS</label><span className="mono">${fmt(org.filing.totassetsend)}</span></div>
                  <div><label>CONTRIBUTIONS</label><span className="mono">${fmt(org.filing.totcntrbgfts)}</span></div>
                </div>
                <Ledger findings={org.findings} score={org.score} />
                <Stamp score={org.score} />
                {org.pdf && <a className="tl-pdf" href={org.pdf} target="_blank" rel="noreferrer">View the filed Form 990 PDF →</a>}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------- shared pieces ---------------- */
function Ledger({ findings, score }) {
  return (
    <div className="tl-ledger">
      <div className="tl-line head"><span>FINDING</span><span className="r">DEDUCTION</span></div>
      <div className="tl-line"><span>Opening balance — benefit of the doubt</span><span className="mono r">10.00</span></div>
      {findings.map((f, i) => (
        <div key={i} className="tl-line">
          <span>
            <b className={f.na ? "na" : f.ok ? "ok" : "bad"}>{f.na ? "◌" : f.ok ? "✓" : "✗"}</b> {f.label}
            <em>{f.detail}</em>
          </span>
          <span className={"mono r " + (f.na ? "na" : f.points > 0 ? "bad" : "ok")}>
            {f.na ? "N/A" : f.points > 0 ? "− " + f.points.toFixed(2) : "—"}
          </span>
        </div>
      ))}
      <div className="tl-line total"><span>TRUST SCORE</span><span className="mono r">{score.toFixed(2)}</span></div>
    </div>
  );
}
function Stamp({ score }) {
  return (
    <div className={"tl-stamp g-" + grade(score)}>
      <div className="mono big">{score.toFixed(1)}</div>
      <div className="lbl">{grade(score)}</div>
    </div>
  );
}

const css = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..125,400..900&family=Public+Sans:wght@400;600;700&family=IBM+Plex+Mono:wght@400;600&display=swap');

.tl-root{
  --paper:#F1F4EC; --ink:#17281E; --line:#C7D2BF; --red:#B3261E; --ok:#2F6B4B; --amber:#8F6400;
  background:var(--paper); color:var(--ink);
  font-family:'Public Sans',system-ui,sans-serif; min-height:100vh;
  max-width:880px; margin:0 auto; padding:40px 20px 64px;
  background-image:repeating-linear-gradient(to bottom, transparent 0 27px, rgba(23,40,30,.045) 27px 28px);
}
.mono{font-family:'IBM Plex Mono',monospace;}
.r{text-align:right;}
.ok{color:var(--ok);} .bad{color:var(--red);} .na{color:var(--amber);}

.tl-head{border-bottom:3px double var(--ink); padding-bottom:20px; margin-bottom:24px;}
.tl-eyebrow{font-family:'IBM Plex Mono',monospace; font-size:11px; letter-spacing:.14em; color:var(--amber); margin-bottom:10px;}
.tl-head h1{font-family:'Archivo',sans-serif; font-weight:900; font-stretch:112%; font-size:clamp(40px,7vw,64px); line-height:.95; margin:0 0 12px; letter-spacing:-.01em;}
.tl-sub{max-width:60ch; font-size:15px; line-height:1.55; margin:0 0 16px;}
.tl-sub .mono{font-weight:600;}
.tl-modetoggle{display:inline-flex; border:1.5px solid var(--ink);}
.tl-modetoggle button{background:transparent; border:none; padding:9px 16px; font-size:13px; font-weight:700;
  color:var(--ink); cursor:pointer; border-right:1.5px solid var(--ink); font-family:'Public Sans',sans-serif;}
.tl-modetoggle button:last-child{border-right:none;}
.tl-modetoggle button.on{background:var(--ink); color:var(--paper);}
.tl-modetoggle button:focus-visible{outline:2px solid var(--ok); outline-offset:-3px;}

.tl-controls{display:flex; gap:16px; flex-wrap:wrap; align-items:flex-end; margin-bottom:14px;}
.tl-field{flex:1; min-width:240px;}
.tl-field label{display:block; font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.12em; margin-bottom:5px;}
.tl-field input{width:100%; box-sizing:border-box; border:1.5px solid var(--ink); background:#fff;
  padding:10px 12px; font-family:'IBM Plex Mono',monospace; font-size:14px; color:var(--ink); border-radius:0;}
.tl-field input:focus{outline:2px solid var(--ok); outline-offset:1px;}
.tl-go{border:1.5px solid var(--ink); background:var(--ink); color:var(--paper); padding:10px 18px;
  font-family:'Public Sans',sans-serif; font-size:14px; font-weight:700; cursor:pointer;}
.tl-go:disabled{opacity:.55; cursor:wait;}
.tl-go:focus-visible{outline:2px solid var(--ok); outline-offset:2px;}
.tl-toggle{display:flex; border:1.5px solid var(--ink);}
.tl-toggle button{background:transparent; border:none; padding:10px 14px; font-size:13px; font-weight:600;
  color:var(--ink); cursor:pointer; border-right:1.5px solid var(--ink); font-family:'Public Sans',sans-serif;}
.tl-toggle button:last-child{border-right:none;}
.tl-toggle button.on{background:var(--ink); color:var(--paper);}
.tl-toggle button:focus-visible{outline:2px solid var(--ok); outline-offset:-3px;}

.tl-note{font-size:12.5px; color:#4c5c50; margin-bottom:14px;}
.tl-error{border:1.5px solid var(--red); color:var(--ink); background:rgba(179,38,30,.06);
  padding:12px 14px; font-size:13.5px; line-height:1.5; margin-bottom:16px;}

.tl-listhead{display:grid; grid-template-columns:1fr 110px 90px 60px 70px; gap:10px;
  font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.12em;
  padding:0 12px 6px; border-bottom:1.5px solid var(--ink);}
.tl-listhead.live{grid-template-columns:1fr 160px 110px;}
.tl-empty{padding:32px 12px; font-size:14px;}

.tl-row{border-bottom:1px solid var(--line);}
.tl-row.open{background:#fff; border:1.5px solid var(--ink); margin:0 -1px;}
.tl-rowmain{display:grid; grid-template-columns:1fr 110px 90px 60px 70px; gap:10px; align-items:center;
  width:100%; text-align:left; background:none; border:none; padding:14px 12px; cursor:pointer;
  font-size:14px; color:var(--ink); font-family:'Public Sans',sans-serif;}
.tl-rowmain.live{grid-template-columns:1fr 160px 110px;}
.tl-rowmain:hover{background:rgba(47,107,75,.06);}
.tl-rowmain:focus-visible{outline:2px solid var(--ok); outline-offset:-2px;}
.tl-name{font-weight:700; display:flex; flex-direction:column; gap:2px;}
.tl-ein{font-size:11px; font-weight:400; color:#5a6a5e;}
.tl-type{font-size:12px; font-weight:600;}
.tl-type.foundation{color:var(--amber);}
.tl-score{font-weight:600; font-size:17px;}
.g-STRONG{color:var(--ok);} .g-FAIR{color:var(--ink);} .g-WEAK{color:var(--amber);} .g-FLAGGED{color:var(--red);}

.tl-detail{padding:4px 16px 20px; position:relative;}
.tl-detail.standalone{padding-top:16px;}
.tl-back{background:none; border:none; color:var(--ok); font-weight:700; font-size:13px;
  cursor:pointer; padding:0 0 10px; font-family:'Public Sans',sans-serif;}
.tl-back:focus-visible{outline:2px solid var(--ok); outline-offset:2px;}
.tl-orgname{font-family:'Archivo',sans-serif; font-weight:900; font-size:26px; margin:0 0 4px; max-width:22ch;}
.tl-mission{font-size:14px; margin:6px 0 14px; max-width:56ch;}
.tl-statrow{display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:10px; margin-bottom:16px;}
.tl-statrow div{border:1px solid var(--line); background:var(--paper); padding:8px 10px;}
.tl-statrow label{display:block; font-family:'IBM Plex Mono',monospace; font-size:9px; letter-spacing:.12em; margin-bottom:3px; color:#4c5c50;}
.tl-statrow span{font-size:16px; font-weight:600;}

.tl-ledger{border-top:1.5px solid var(--ink);}
.tl-line{display:flex; justify-content:space-between; gap:16px; padding:9px 2px; border-bottom:1px solid var(--line); font-size:14px;}
.tl-line.head{font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.12em; border-bottom:1.5px solid var(--ink);}
.tl-line em{display:block; font-style:normal; font-size:12.5px; color:#4c5c50; margin-top:2px;}
.tl-line b{margin-right:6px;}
.tl-line.total{border-top:3px double var(--ink); border-bottom:none; font-weight:700; font-size:16px; padding-top:12px;}

.tl-stamp{position:absolute; right:20px; top:10px; transform:rotate(-7deg);
  border:3px double currentColor; padding:8px 16px; text-align:center; opacity:.92; background:rgba(255,255,255,.6);}
.tl-detail.standalone .tl-stamp{top:44px;}
.tl-stamp .big{font-size:30px; font-weight:600; line-height:1;}
.tl-stamp .lbl{font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.2em; margin-top:3px;}

.tl-pdf{display:inline-block; margin-top:16px; color:var(--ok); font-weight:700; font-size:14px;}

.tl-foot{margin-top:36px; padding-top:16px; border-top:3px double var(--ink); font-size:13px; line-height:1.6; max-width:70ch;}

@media (max-width:640px){
  .tl-listhead{grid-template-columns:1fr 60px 70px;}
  .tl-listhead span:nth-child(2), .tl-listhead span:nth-child(4){display:none;}
  .tl-listhead.live{grid-template-columns:1fr 90px;}
  .tl-listhead.live span:nth-child(2){display:none;}
  .tl-rowmain{grid-template-columns:1fr 60px 70px;}
  .tl-rowmain .tl-type, .tl-rowmain span:nth-child(4){display:none;}
  .tl-rowmain.live{grid-template-columns:1fr 90px;}
  .tl-rowmain.live span:nth-child(2){display:none;}
  .tl-stamp{position:static; transform:rotate(-4deg); margin-top:14px; display:inline-block;}
}
@media (prefers-reduced-motion: reduce){ *{transition:none!important;} }
`;
