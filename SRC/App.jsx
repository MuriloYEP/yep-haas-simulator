import React, { useEffect, useMemo, useState } from "react";

/**
 * YEP — Renting (HaaS) vs Compra — Simulador Interativo (v2.1)
 * Com: margem interna, partilha por link, validações e logo.
 */

// ---------- Helpers ----------
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const fmt = (n, currency) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency, maximumFractionDigits: 2 }).format(isFinite(n) ? n : 0);

const toNumber = (s) => {
  if (typeof s === "number") return s;
  const k = String(s ?? "").replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const v = parseFloat(k);
  return isNaN(v) ? 0 : v;
};

const monthlyRate = (annual) => Math.pow(1 + annual, 1 / 12) - 1; // annual decimal
const annuityFactor = (r, n) => (r === 0 ? n : (1 - Math.pow(1 + r, -n)) / r);
const pmt = (pv, r, n) => (r === 0 ? pv / n : (pv * r) / (1 - Math.pow(1 + r, -n)));
const NPV = (rate, cashflows) => cashflows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rate, t), 0);

// ---------- Presets ----------
const PRESETS = {
  PDT: { label: "Coletor de dados (PDT)", purchasePrice: 1200, realCost: 800, maintenancePctYear: 0.08, incidentsPerYear: 1.2, freightPerIncident: 60, downtimeDaysYear_Buy: 3, downtimeDaysYear_Rent: 0.5, residualPct: 0.2 },
  HHT: { label: "Terminal portátil (handheld)", purchasePrice: 1100, realCost: 760, maintenancePctYear: 0.08, incidentsPerYear: 1.1, freightPerIncident: 50, downtimeDaysYear_Buy: 2.5, downtimeDaysYear_Rent: 0.5, residualPct: 0.18 },
  PRN: { label: "Impressora industrial", purchasePrice: 2000, realCost: 1400, maintenancePctYear: 0.10, incidentsPerYear: 1.4, freightPerIncident: 80, downtimeDaysYear_Buy: 2, downtimeDaysYear_Rent: 0.3, residualPct: 0.22 },
  TAB: { label: "Tablet robusto", purchasePrice: 900, realCost: 600, maintenancePctYear: 0.07, incidentsPerYear: 0.8, freightPerIncident: 40, downtimeDaysYear_Buy: 1.5, downtimeDaysYear_Rent: 0.3, residualPct: 0.15 },
};

const TERM_PAYBACK = { 24: 15, 36: 20, 48: 24 };

// ---------- Text-number input ----------
function TextNum({ value, onChange, suffix, min = -Infinity, max = Infinity }) {
  const [txt, setTxt] = useState(String(value));
  useEffect(() => { setTxt(String(value)); }, [value]);
  const commit = () => { const v = toNumber(txt); onChange(clamp(v, min, max)); };
  return (
    <div className="flex rounded-xl border border-zinc-300 dark:border-zinc-700 overflow-hidden focus-within:ring-2 focus-within:ring-sky-500">
      <input
        type="text"
        className="w-full bg-white/50 dark:bg-zinc-900/40 px-3 py-2 outline-none"
        value={txt}
        inputMode="decimal"
        onChange={(e) => setTxt(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setTxt(String(value)); e.currentTarget.blur(); } }}
      />
      {suffix && <div className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 text-sm">{suffix}</div>}
    </div>
  );
}

// ---------- Modal ----------
function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="text-sm opacity-70 hover:opacity-100" onClick={onClose}>Fechar</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  // --------- State ---------
  const [currency, setCurrency] = useState("EUR");
  const [equipKey, setEquipKey] = useState("PDT");
  const [qty, setQty] = useState(10);
  const [term, setTerm] = useState(36);
  const [annualRate, setAnnualRate] = useState(0.16);
  const [taxRate, setTaxRate] = useState(0.21);
  const [vat, setVat] = useState(0.23);
  const [deprMonths, setDeprMonths] = useState(36);
  const [costPerDownDay, setCostPerDownDay] = useState(300);
  const [bottleneckPerMonth, setBottleneckPerMonth] = useState(0);
  const [includeFreightInRent, setIncludeFreightInRent] = useState(false);

  // Purchase knobs (cliente)
  const [purchasePrice, setPurchasePrice] = useState(PRESETS[equipKey].purchasePrice); // venda ao cliente (COMPRAR)
  const [maintenancePctYear, setMaintenancePctYear] = useState(PRESETS[equipKey].maintenancePctYear);
  const [incidentsPerYear, setIncidentsPerYear] = useState(PRESETS[equipKey].incidentsPerYear);
  const [freightPerIncident, setFreightPerIncident] = useState(PRESETS[equipKey].freightPerIncident);
  const [downtimeDaysYear_Buy, setDowntimeDaysYear_Buy] = useState(PRESETS[equipKey].downtimeDaysYear_Buy);
  const [residualPct, setResidualPct] = useState(PRESETS[equipKey].residualPct);

  // Renting knobs (cliente)
  const [downtimeDaysYear_Rent, setDowntimeDaysYear_Rent] = useState(PRESETS[equipKey].downtimeDaysYear_Rent);

  // Interno (YEP)
  const [internalMode, setInternalMode] = useState(false);
  const [realCost, setRealCost] = useState(PRESETS[equipKey].realCost); // custo real interno
  const [serviceCostPerUnitMonth, setServiceCostPerUnitMonth] = useState(12);
  const [overheadPctOnRealCost, setOverheadPctOnRealCost] = useState(0.04);
  const [overridePayback, setOverridePayback] = useState(false);
  const [paybackMonths, setPaybackMonths] = useState(TERM_PAYBACK[term]);

  // Share modal
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareCopied, setShareCopied] = useState(false);

  // Sync preset when equipment changes
  useEffect(() => {
    const p = PRESETS[equipKey];
    setPurchasePrice(p.purchasePrice);
    setRealCost(p.realCost);
    setMaintenancePctYear(p.maintenancePctYear);
    setIncidentsPerYear(p.incidentsPerYear);
    setFreightPerIncident(p.freightPerIncident);
    setDowntimeDaysYear_Buy(p.downtimeDaysYear_Buy);
    setDowntimeDaysYear_Rent(p.downtimeDaysYear_Rent);
    setResidualPct(p.residualPct);
  }, [equipKey]);

  useEffect(() => { if (!overridePayback) setPaybackMonths(TERM_PAYBACK[term]); }, [term, overridePayback]);

  // ---------- Math ----------
  const r_m = useMemo(() => monthlyRate(annualRate), [annualRate]);
  const AF = useMemo(() => annuityFactor(r_m, term), [r_m, term]);

  // Renting price por unidade (ex VAT): recupera CUSTO REAL no payback + SLA + overhead (regra solicitada)
  const basePMT = useMemo(() => pmt(realCost, r_m, paybackMonths), [realCost, r_m, paybackMonths]);
  const overheadPerMonth = useMemo(() => (overheadPctOnRealCost * realCost) / term, [overheadPctOnRealCost, realCost, term]);
  const monthlyRentPerUnit_exVAT = useMemo(() => basePMT + serviceCostPerUnitMonth + overheadPerMonth, [basePMT, serviceCostPerUnitMonth, overheadPerMonth]);
  const monthlyRentPerUnit_afterTax = useMemo(() => monthlyRentPerUnit_exVAT * (1 - taxRate), [monthlyRentPerUnit_exVAT, taxRate]);

  // Custos residuais no Renting
  const monthlyDowntimeRent = useMemo(() => (downtimeDaysYear_Rent * costPerDownDay) / 12, [downtimeDaysYear_Rent, costPerDownDay]);
  const monthlyFreightRent = useMemo(() => includeFreightInRent ? (incidentsPerYear * freightPerIncident) / 12 : 0, [includeFreightInRent, incidentsPerYear, freightPerIncident]);

  // BUY path
  const monthlyMaintBuy = useMemo(() => (purchasePrice * maintenancePctYear) / 12, [purchasePrice, maintenancePctYear]);
  const monthlyFreightBuy = useMemo(() => (incidentsPerYear * freightPerIncident) / 12, [incidentsPerYear, freightPerIncident]);
  const monthlyDowntimeBuy = useMemo(() => (downtimeDaysYear_Buy * costPerDownDay) / 12, [downtimeDaysYear_Buy, costPerDownDay]);
  const monthlyBottleneck = bottleneckPerMonth;
  const monthlyDepr = useMemo(() => ((purchasePrice * (1 - residualPct)) / deprMonths), [purchasePrice, residualPct, deprMonths]);

  const mMaint_after = useMemo(() => monthlyMaintBuy * (1 - taxRate), [monthlyMaintBuy, taxRate]);
  const mFreight_after = useMemo(() => monthlyFreightBuy * (1 - taxRate), [monthlyFreightBuy, taxRate]);
  const mDown_after = useMemo(() => monthlyDowntimeBuy * (1 - taxRate), [monthlyDowntimeBuy, taxRate]);
  const mBottle_after = useMemo(() => monthlyBottleneck * (1 - taxRate), [monthlyBottleneck, taxRate]);
  const mDeprShield = useMemo(() => monthlyDepr * taxRate, [monthlyDepr, taxRate]);

  const PV_buy_afterTax_perUnit = useMemo(() => {
    const flows = [];
    flows.push(-purchasePrice);
    for (let t = 1; t <= term; t++) {
      const m = -(mMaint_after + mFreight_after + mDown_after + mBottle_after) + mDeprShield;
      flows.push(m);
    }
    flows[term] += purchasePrice * residualPct; // inflow terminal
    return NPV(r_m, flows);
  }, [purchasePrice, term, mMaint_after, mFreight_after, mDown_after, mBottle_after, mDeprShield, residualPct, r_m]);

  const EAC_buy_afterTax_perUnit = useMemo(() => -PV_buy_afterTax_perUnit / AF || 0, [PV_buy_afterTax_perUnit, AF]);

  // Renting EAC (após imposto)
  const EAC_rent_afterTax_perUnit = useMemo(
    () => monthlyRentPerUnit_afterTax + (monthlyDowntimeRent + monthlyFreightRent) * (1 - taxRate),
    [monthlyRentPerUnit_afterTax, monthlyDowntimeRent, monthlyFreightRent, taxRate]
  );

  // Totais
  const totalRent_month_exVAT = monthlyRentPerUnit_exVAT * qty;
  const totalRent_month_inclVAT = totalRent_month_exVAT * (1 + vat);
  const totalBuy_EAC_afterTax = EAC_buy_afterTax_perUnit * qty;
  const diff_perMonth_afterTax = totalBuy_EAC_afterTax - EAC_rent_afterTax_perUnit * qty; // >0 => Renting mais barato

  // Reconciliação (totais ao longo do prazo)
  const rentTotalOverTerm_exVAT_perUnit = monthlyRentPerUnit_exVAT * term;
  const saleOneOff_perUnit = purchasePrice; // venda à vista

  // Margens internas
  const costOverTerm_internal = (serviceCostPerUnitMonth + overheadPerMonth) * term + realCost;
  const grossRevenueOverTerm = monthlyRentPerUnit_exVAT * term;
  const marginInternal_perUnit_contract = grossRevenueOverTerm - costOverTerm_internal;
  const marginInternal_total = marginInternal_perUnit_contract * qty;
  const marginRate_contract = grossRevenueOverTerm > 0 ? marginInternal_perUnit_contract / grossRevenueOverTerm : 0;

  const grossRevenueUntilPayback = monthlyRentPerUnit_exVAT * paybackMonths;
  const costUntilPayback = realCost + (serviceCostPerUnitMonth + overheadPerMonth) * paybackMonths;
  const marginUntilPayback_perUnit = grossRevenueUntilPayback - costUntilPayback;

  // Validação: preço de venda precisa ser > custo real interno
  const invalidPriceVsCost = purchasePrice <= realCost;

  // ---------- UI ----------
  const L = (k) => ({
    title: "Renting (HaaS) vs Compra — Simulador Interativo YEP",
    subtitle: "Compare custos mensais equivalentes e veja a reconciliação Venda vs Renting.",
    customerInputs: "Entradas (Cliente)",
    internalInputs: "Controlo interno",
    results: "Resultados",
    share: "Partilhar cenário",
    reset: "Repor",
    qty: "Quantidade",
    term: "Prazo do contrato",
    months: "meses",
    rate: "Custo de capital (anual)",
    tax: "Imposto (IRC)",
    vat: "IVA",
    depr: "Depreciação (meses)",
    equip: "Tipo de equipamento",
    priceBuy: "Preço de venda ao cliente (se comprar)",
    maintPct: "Manutenção anual (% do preço)",
    incidents: "Incidências/avarias por ano",
    freightPer: "Frete por incidência",
    downtimeBuy: "Dias de paragem/ano (compra)",
    downtimeRent: "Dias de paragem/ano (Renting)",
    downCost: "Custo por dia parado",
    bottle: "Custo de gargalo (mês)",
    residual: "Valor residual no fim",
    realCost: "Custo real interno por unidade",
    serviceCost: "Custo real do SLA (mês)",
    overhead: "Overhead sobre custo real",
    paybackOverride: "Alterar payback manualmente",
    paybackMap: "24→15, 36→20, 48→24 meses",
    paybackMonths: "Meses de payback",
    rentPerUnit: "Renting (s/ IVA) — por unidade",
    eacBuy: "EAC se comprar (pós‑imposto) — por unidade",
    advantage: "Vantagem mensal do Renting (pós‑imposto)",
    cta: "Pedir proposta em 24h",
    includeFreightRent: "Incluir frete de manutenção no Renting",
    reconciliation: "Reconciliação de totais (por unidade)",
    sale: "Venda única (compra)",
    rentxterm: "Renting × prazo (s/ IVA)",
    warningPrice: "O preço de venda ao cliente deve ser MAIOR que o custo real interno. Verifique moeda e unidades.",
    tips: "Dicas fiscais",
  }[k]);

  const buildShareUrl = () => {
    const state = { currency, equipKey, qty, term, annualRate, taxRate, vat, deprMonths, costPerDownDay, bottleneckPerMonth,
      purchasePrice, maintenancePctYear, incidentsPerYear, freightPerIncident, downtimeDaysYear_Buy, residualPct, downtimeDaysYear_Rent,
      includeFreightInRent };
    const json = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
    return `${window.location.origin}${window.location.pathname}#${json}`;
  };

  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareCopied, setShareCopied] = useState(false);

  const openShare = async () => {
    const url = buildShareUrl();
    setShareUrl(url);
    setShareOpen(true);
    setShareCopied(false);
    try { await navigator.clipboard.writeText(url); setShareCopied(true); } catch { /* fallback manual no modal */ }
  };

  const Card = ({ title, children, right }) => (
    <div className="bg-white/80 dark:bg-zinc-900/60 backdrop-blur rounded-2xl shadow p-4 md:p-6 border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-zinc-900 dark:text-zinc-100 font-semibold">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-sky-50 to-zinc-50 dark:from-zinc-950 dark:to-zinc-900 text-zinc-900 dark:text-zinc-100">
      <div className="max-w-7xl mx-auto px-4 py-6 md:py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <img src="/logo-bubble.jpg" alt="YEP" className="w-10 h-10 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                 onError={(e)=>{e.currentTarget.style.display='none';}} />
            <div>
              <h1 className="text-xl md:text-2xl font-bold">{L("title")}</h1>
              <p className="text-sm opacity-80">{L("subtitle")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2" value={currency} onChange={(e)=>setCurrency(e.target.value)}>
              <option>EUR</option><option>USD</option><option>BRL</option><option>GBP</option>
            </select>
            <button onClick={openShare} className="rounded-xl bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 shadow">{L("share")}</button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4 md:gap-6">
          {/* Left */}
          <div className="col-span-12 lg:col-span-5 space-y-4">
            <Card title={L("customerInputs")} right={<label className="text-xs flex items-center gap-2"><input type="checkbox" checked={internalMode} onChange={(e)=>setInternalMode(e.target.checked)} />{L("internalInputs")}</label>}>
              {invalidPriceVsCost && (
                <div className="mb-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-800 text-sm p-3">
                  <b>Atenção:</b> {L("warningPrice")}
                </div>
              )}

              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-12">
                  <label className="text-sm">{L("equip")}</label>
                  <select className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 mt-1" value={equipKey} onChange={(e)=>setEquipKey(e.target.value)}>
                    {Object.entries(PRESETS).map(([k,v])=> (<option key={k} value={k}>{v.label}</option>))}
                  </select>
                </div>

                <div className="col-span-6">
                  <label className="text-sm">{L("qty")}</label>
                  <TextNum value={qty} onChange={(v)=>setQty(clamp(v,1,10000))} suffix={"un"} />
                </div>
                <div className="col-span-6">
                  <label className="text-sm">{L("term")} — {term} {L("months")}</label>
                  <div className="flex gap-2 mt-1">
                    {[24,36,48].map((m)=> (
                      <button key={m} onClick={()=>setTerm(m)} className={`px-3 py-2 rounded-xl border ${term===m?"border-sky-600 bg-sky-50 dark:bg-sky-900/20":"border-zinc-300 dark:border-zinc-700"}`}>{m}</button>
                    ))}
                  </div>
                  <div className="text-xs opacity-70 mt-1">{L("paybackMap")}</div>
                </div>

                <div className="col-span-6">
                  <label className="text-sm">{L("rate")} — {(annualRate*100).toFixed(1)}%</label>
                  <input type="range" className="w-full" min={0} max={0.4} step={0.001} value={annualRate} onChange={(e)=>setAnnualRate(parseFloat(e.target.value))} />
                  <div className="text-xs opacity-70">r_m = {(monthlyRate(annualRate)*100).toFixed(2)}%/mês</div>
                </div>
                <div className="col-span-6">
                  <label className="text-sm">{L("tax")} — {(taxRate*100).toFixed(0)}%</label>
                  <input type="range" className="w-full" min={0} max={0.35} step={0.01} value={taxRate} onChange={(e)=>setTaxRate(parseFloat(e.target.value))} />
                </div>

                <div className="col-span-6">
                  <label className="text-sm">{L("vat")} — {(vat*100).toFixed(0)}%</label>
                  <input type="range" className="w-full" min={0} max={0.23} step={0.01} value={vat} onChange={(e)=>setVat(parseFloat(e.target.value))} />
                  <div className="text-xs opacity-60 mt-1">IVA apenas para exibição do total com IVA. Comparação de custos (EAC) é sem IVA, pois empresas deduzem.</div>
                </div>
                <div className="col-span-6">
                  <label className="text-sm">{L("depr")}</label>
                  <TextNum value={deprMonths} onChange={(v)=>setDeprMonths(clamp(v,12,84))} suffix={L("months")} />
                  <div className="text-xs opacity-60 mt-1">Define vida útil linear usada no escudo fiscal da compra (EAC).</div>
                </div>

                <div className={`col-span-6`}>
                  <label className={`text-sm ${invalidPriceVsCost?"text-rose-700": ""}`}>{L("priceBuy")}</label>
                  <div className={invalidPriceVsCost?"rounded-2xl p-[2px] border-2 border-rose-500":""}>
                    <TextNum value={purchasePrice} onChange={setPurchasePrice} suffix={currency} />
                  </div>
                </div>
                <div className="col-span-6">
                  <label className="text-sm">{L("maintPct")} — {(maintenancePctYear*100).toFixed(1)}%</label>
                  <input type="range" className="w-full" min={0} max={0.25} step={0.005} value={maintenancePctYear} onChange={(e)=>setMaintenancePctYear(parseFloat(e.target.value))} />
                </div>

                <div className="col-span-4">
                  <label className="text-sm">{L("incidents")}</label>
                  <TextNum value={incidentsPerYear} onChange={setIncidentsPerYear} />
                </div>
                <div className="col-span-4">
                  <label className="text-sm">{L("freightPer")}</label>
                  <TextNum value={freightPerIncident} onChange={setFreightPerIncident} suffix={currency} />
                </div>
                <div className="col-span-4">
                  <label className="text-sm">{L("downCost")}</label>
                  <TextNum value={costPerDownDay} onChange={setCostPerDownDay} suffix={currency} />
                </div>

                <div className="col-span-6">
                  <label className="text-sm">{L("downtimeBuy")}</label>
                  <TextNum value={downtimeDaysYear_Buy} onChange={setDowntimeDaysYear_Buy} />
                </div>
                <div className="col-span-6">
                  <label className="text-sm">{L("downtimeRent")}</label>
                  <TextNum value={downtimeDaysYear_Rent} onChange={setDowntimeDaysYear_Rent} />
                </div>

                <div className="col-span-6">
                  <label className="text-sm">{L("bottle")}</label>
                  <TextNum value={bottleneckPerMonth} onChange={setBottleneckPerMonth} suffix={currency} />
                </div>
                <div className="col-span-6">
                  <label className="text-sm">{L("residual")} — {(residualPct*100).toFixed(0)}%</label>
                  <input type="range" className="w-full" min={0} max={0.5} step={0.01} value={residualPct} onChange={(e)=>setResidualPct(parseFloat(e.target.value))} />
                </div>

                <div className="col-span-12 flex items-center gap-2">
                  <input type="checkbox" checked={includeFreightInRent} onChange={(e)=>setIncludeFreightInRent(e.target.checked)} />
                  <span className="text-sm">{L("includeFreightRent")}</span>
                </div>

                <div className="col-span-12 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 p-3 text-xs">
                  <b>{L("tips")}:</b> IRC padrão 21% em PT (use a taxa efetiva do cliente; derramas podem aplicar). Depreciação: 36 meses é comum em AIDC; 48–60m para ativos mais robustos.
                </div>
              </div>
            </Card>

            {internalMode && (
              <Card title={L("internalInputs")}> 
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-6">
                    <label className="text-sm">{L("realCost")}</label>
                    <TextNum value={realCost} onChange={setRealCost} suffix={currency} />
                  </div>
                  <div className="col-span-6">
                    <label className="text-sm">{L("serviceCost")}</label>
                    <TextNum value={serviceCostPerUnitMonth} onChange={setServiceCostPerUnitMonth} suffix={currency} />
                  </div>
                  <div className="col-span-12">
                    <label className="text-sm">{L("overhead")} — {(overheadPctOnRealCost*100).toFixed(1)}%</label>
                    <input type="range" className="w-full" min={0} max={0.2} step={0.005} value={overheadPctOnRealCost} onChange={(e)=>setOverheadPctOnRealCost(parseFloat(e.target.value))} />
                  </div>
                  <div className="col-span-12">
                    <label className="text-sm">{L("paybackOverride")} ({L("paybackMonths")}):</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input type="checkbox" checked={overridePayback} onChange={(e)=>setOverridePayback(e.target.checked)} />
                      <TextNum value={paybackMonths} onChange={(v)=>setPaybackMonths(clamp(v,6,term))} suffix={L("months")} />
                      <span className="text-xs opacity-70">{L("paybackMap")}</span>
                    </div>
                  </div>

                  {/* Margens internas */}
                  <div className="col-span-12 grid sm:grid-cols-2 gap-3 mt-2">
                    <div className="rounded-xl p-3 border border-zinc-200 dark:border-zinc-800">
                      <div className="text-xs opacity-70">Margem até payback (por un.)</div>
                      <div className="font-semibold">{fmt(marginUntilPayback_perUnit, currency)}</div>
                    </div>
                    <div className="rounded-xl p-3 border border-zinc-200 dark:border-zinc-800">
                      <div className="text-xs opacity-70">Margem no contrato (por un.)</div>
                      <div className="font-semibold">{fmt(marginInternal_perUnit_contract, currency)} ({(marginRate_contract*100).toFixed(1)}%)</div>
                    </div>
                    <div className="rounded-xl p-3 border border-zinc-200 dark:border-zinc-800 sm:col-span-2">
                      <div className="text-xs opacity-70">Margem total (quantidade)</div>
                      <div className="font-semibold">{fmt(marginInternal_total, currency)}</div>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Right */}
          <div className="col-span-12 lg:col-span-7 space-y-4">
            <Card title={L("results")} right={<button onClick={()=>window.location.reload()} className="text-sm opacity-80 hover:opacity-100">{L("reset")}</button>}>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="rounded-2xl p-4 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800">
                  <div className="text-xs opacity-70 mb-1">{L("rentPerUnit")}</div>
                  <div className="text-2xl font-bold">{fmt(monthlyRentPerUnit_exVAT, currency)}</div>
                  <div className="text-xs opacity-70">{L("months")}: {term} | Payback: {paybackMonths}</div>
                </div>
                <div className="rounded-2xl p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                  <div className="text-xs opacity-70 mb-1">{L("eacBuy")}</div>
                  <div className="text-2xl font-bold">{fmt(EAC_buy_afterTax_perUnit, currency)}</div>
                  <div className="text-xs opacity-70">/unidade</div>
                </div>
                <div className={`${diff_perMonth_afterTax>0 && !invalidPriceVsCost?"bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800":"bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800"} rounded-2xl p-4 border`}> 
                  <div className="text-xs opacity-70 mb-1">{L("advantage")}</div>
                  <div className="text-2xl font-bold">{invalidPriceVsCost?"—": fmt(diff_perMonth_afterTax/qty, currency)} /un</div>
                  <div className="text-xs opacity-70">{invalidPriceVsCost?"Corrija o preço vs custo real": (diff_perMonth_afterTax>0?"Renting mais barato":"Renting mais caro")}</div>
                </div>
              </div>

              {/* Barras comparativas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="rounded-2xl p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <div className="text-sm font-medium mb-1">Custo mensal (pós‑imposto) — TOTAL</div>
                  <div className="space-y-2 mt-2">
                    {[
                      {label: "Renting", value: invalidPriceVsCost?0:EAC_rent_afterTax_perUnit*qty},
                      {label: "Compra", value: invalidPriceVsCost?0:totalBuy_EAC_afterTax},
                    ].map((row)=>{
                      const max = Math.max(invalidPriceVsCost?1:(EAC_rent_afterTax_perUnit*qty), invalidPriceVsCost?1:totalBuy_EAC_afterTax, 1);
                      const w = Math.max(2, (row.value / max) * 100);
                      return (
                        <div key={row.label} className="text-sm">
                          <div className="flex justify-between"><span className="opacity-80">{row.label}</span><span className="font-mono">{invalidPriceVsCost?"—":fmt(row.value, currency)}</span></div>
                          <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden mt-1">
                            <div className={`h-3 ${row.label==="Renting"?"bg-sky-500":"bg-zinc-500"}`} style={{width: w+"%"}} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-2xl p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                  <div className="text-sm font-medium mb-1">{L("reconciliation")}</div>
                  <ul className="text-sm space-y-1">
                    <li>{L("sale")}: <b>{fmt(saleOneOff_perUnit, currency)}</b></li>
                    <li>{L("rentxterm")}: <b>{fmt(rentTotalOverTerm_exVAT_perUnit, currency)}</b> ({fmt(monthlyRentPerUnit_exVAT, currency)} × {term})</li>
                    <li className="text-xs opacity-70">Nota: reconciliação sem IVA e sem efeitos fiscais; serve apenas para comparação bruta de totais.</li>
                  </ul>
                </div>
              </div>

              <div className="text-xs opacity-70 mt-4">Modelo simplificado. Depreciação linear; impostos na alienação não modelados. Confirme com o seu consultor fiscal.</div>
            </Card>

            <Card title="Vantagens do Renting YEP">
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Pagamento mensal <b>OPEX previsível</b> com SLA incluído.</li>
                <li><b>Sem CAPEX</b> imobilizado; menor risco tecnológico.</li>
                <li>Menos paragens: de {downtimeDaysYear_Buy.toFixed(1)} para {downtimeDaysYear_Rent.toFixed(1)} dia(s)/ano (ajustável).</li>
                <li>Processo de aprovação <b>rápido</b> e financiamento próprio.</li>
                <li>No fim: comprar com desconto, renovar ou prolongar.</li>
              </ul>
            </Card>

            <div className="flex justify-end">
              <button className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 shadow">{L("cta")}</button>
            </div>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      <Modal open={shareOpen} title="Partilhar cenário" onClose={()=>setShareOpen(false)}>
        <div className="space-y-2">
          <div className="text-sm">Copie o link abaixo e partilhe com o cliente ou equipa. {shareCopied && <span className="text-emerald-600 font-medium">(Copiado!)</span>}</div>
          <div className="rounded-xl border border-zinc-300 dark:border-zinc-700 p-2 bg-zinc-50 dark:bg-zinc-800/40 break-all text-xs">
            {shareUrl}
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-3 py-2" onClick={()=>{ navigator.clipboard.writeText(shareUrl).then(()=>setShareCopied(true)).catch(()=>{}); }}>Copiar link</button>
            <button className="rounded-xl bg-sky-600 hover:bg-sky-700 text-white px-4 py-2" onClick={()=>setShareOpen(false)}>Fechar</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
