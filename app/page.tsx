"use client";

import { useState, useEffect } from "react";
import { supabase } from "./supabase";

const KATEGORI_BUDGET = [
  "Tabungan",
  "Keluarga",
  "Tagihan Bulanan",
  "Kendaraan",
  "Makanan dan Harian",
  "Sosial",
  "Insidentil & Aset"
];

const CATEGORY_ICONS: Record<string, string> = {
  "Tabungan": "💎",
  "Keluarga": "👨‍👩‍👧",
  "Tagihan Bulanan": "📄",
  "Kendaraan": "🛵",
  "Makanan dan Harian": "🍜",
  "Sosial": "🤝",
  "Insidentil & Aset": "🛍️",
  "Gaji Perusahaan": "💼",
  "Bonus/THR": "🎁",
  "Pekerjaan Lain": "🚀",
  "Penarikan Tabungan": "📥"
};

const getPeriodFromDate = (dateStr: string) => {
  const d = new Date(dateStr);
  let y = d.getFullYear();
  let m = d.getMonth() + 1;
  if (d.getDate() >= 25) {
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return `${y}-${String(m).padStart(2, '0')}`;
};

const getPeriodDates = (periodStr: string) => {
  const [y, m] = periodStr.split('-');
  let year = parseInt(y);
  let month = parseInt(m);
  
  let prevMonth = month - 1;
  let prevYear = year;
  if (prevMonth < 1) { prevMonth = 12; prevYear -= 1; }

  return {
    startStr: `${prevYear}-${String(prevMonth).padStart(2, '0')}-25`,
    endStr: `${year}-${String(month).padStart(2, '0')}-24`
  };
};

const formatPeriodDisplay = (periodStr: string) => {
  if (!periodStr) return "";
  const [year, month] = periodStr.split('-');
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sept", "Okt", "Nov", "Des"];
  return `${months[parseInt(month) - 1]} ${year}`;
};

const CURRENT_PERIOD = getPeriodFromDate(new Date().toISOString());

export default function Home() {
  const [activeTab, setActiveTab] = useState("transaksi");
  
  const [saldo, setSaldo] = useState<number>(0);
  const [riwayat, setRiwayat] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("expense");
  const [category, setCategory] = useState("Makanan dan Harian");
  const [description, setDescription] = useState("");
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().split('T')[0]);
  const [penginput, setPenginput] = useState("Istri");
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState(CURRENT_PERIOD);
  const [kelolaPeriod, setKelolaPeriod] = useState(CURRENT_PERIOD);

  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetInputs, setBudgetInputs] = useState<Record<string, string>>({});

  const fetchData = async () => {
    const { data: trxData, error: trxError } = await supabase
      .from("transactions")
      .select("*")
      .order("tanggal", { ascending: false })
      .order("created_at", { ascending: false });

    if (trxError) console.error("Gagal mengambil transaksi:", trxError);

    let hitungTotal = 0;
    const periods = new Set<string>();
    periods.add(CURRENT_PERIOD); 

    trxData?.forEach((trx) => {
      if (trx.type === "income") hitungTotal += Number(trx.amount);
      if (trx.type === "expense" && trx.category !== "Tabungan") hitungTotal -= Number(trx.amount);
      if (trx.type === "expense" && trx.category === "Tabungan") hitungTotal -= Number(trx.amount);
      
      if (trx.tanggal) {
        periods.add(getPeriodFromDate(trx.tanggal));
      }
    });
    
    setSaldo(hitungTotal);
    setRiwayat(trxData || []);
    
    const sortedPeriods = Array.from(periods).sort().reverse();
    setAvailablePeriods(sortedPeriods);

    const { data: budgetData, error: budgetError } = await supabase.from("budgets").select("*");
    if (budgetError) console.error("Gagal mengambil budget:", budgetError);
    setBudgets(budgetData || []);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, "");
    setAmount(rawValue ? new Intl.NumberFormat("id-ID").format(Number(rawValue)) : "");
  };

  const handleEdit = (trx: any) => {
    setActiveTab("transaksi");
    setEditId(trx.id);
    setType(trx.type);
    setAmount(new Intl.NumberFormat("id-ID").format(trx.amount));
    setCategory(trx.category);
    setDescription(trx.description || "");
    setTanggal(trx.tanggal || trx.created_at.split('T')[0]);
    setPenginput(trx.penginput || "Istri");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditId(null);
    setAmount("");
    setCategory("Makanan dan Harian");
    setDescription("");
    setTanggal(new Date().toISOString().split('T')[0]);
    setType("expense");
    setPenginput("Istri");
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Hapus transaksi ini secara permanen?")) return;
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (!error) {
      if (editId === id) cancelEdit();
      fetchData();
    }
  };

  const handleSubmitTrx = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const rawAmount = Number(amount.replace(/[^0-9]/g, ""));
    const payload = { amount: rawAmount, type, category, description, tanggal, penginput };

    const { error } = editId 
      ? await supabase.from("transactions").update(payload).eq("id", editId)
      : await supabase.from("transactions").insert([payload]);

    setLoading(false);
    if (!error) {
      cancelEdit(); 
      fetchData(); 
    }
  };

  const openBudgetEdit = () => {
    const initialInputs: Record<string, string> = {};
    KATEGORI_BUDGET.forEach(cat => {
      const existing = budgets.find(b => b.periode === selectedPeriod && b.category === cat);
      initialInputs[cat] = existing ? existing.amount.toString() : "";
    });
    setBudgetInputs(initialInputs);
    setIsEditingBudget(true);
  };

  const handleBudgetChange = (cat: string, value: string) => {
    const rawValue = value.replace(/[^0-9]/g, "");
    setBudgetInputs(prev => ({ ...prev, [cat]: rawValue }));
  };

  const saveBudgets = async () => {
    setLoading(true);
    const upsertData = KATEGORI_BUDGET.map(cat => ({
      periode: selectedPeriod,
      category: cat,
      amount: Number(budgetInputs[cat] || 0)
    }));
    const { error } = await supabase.from("budgets").upsert(upsertData, { onConflict: 'periode,category' });
    setLoading(false);
    if (!error) {
      setIsEditingBudget(false);
      fetchData();
    }
  };

  // --- FILTERING DATA ---
  const { startStr: selStart, endStr: selEnd } = getPeriodDates(selectedPeriod);
  
  const selectedPeriodTrx = riwayat.filter(trx => {
    const tgl = trx.tanggal || trx.created_at.split('T')[0];
    return tgl >= selStart && tgl <= selEnd;
  });
  
  const selectedPeriodExpense = selectedPeriodTrx
    .filter(trx => trx.type === "expense" && trx.category !== "Tabungan")
    .reduce((sum, trx) => sum + Number(trx.amount), 0);

  const selectedPeriodIncome = selectedPeriodTrx
    .filter(trx => trx.type === "income" && trx.category !== "Penarikan Tabungan")
    .reduce((sum, trx) => sum + Number(trx.amount), 0);

  const currentMonthTrx = riwayat.filter(trx => {
    const tgl = trx.tanggal || trx.created_at.split('T')[0];
    const { startStr, endStr } = getPeriodDates(CURRENT_PERIOD);
    return tgl >= startStr && tgl <= endStr;
  });
  
  const totalPemasukanBulanIni = currentMonthTrx
    .filter(trx => trx.type === "income" && trx.category !== "Penarikan Tabungan")
    .reduce((sum, trx) => sum + Number(trx.amount), 0);

  const totalPengeluaranBulanIni = currentMonthTrx
    .filter(trx => trx.type === "expense" && trx.category !== "Tabungan")
    .reduce((sum, trx) => sum + Number(trx.amount), 0);

  const saldoPeriodeIni = totalPemasukanBulanIni - totalPengeluaranBulanIni;

  const allTabunganTrx = riwayat.filter(trx => trx.category === "Tabungan" || trx.category === "Penarikan Tabungan");
  const totalTabungan = allTabunganTrx.reduce((sum, trx) => {
    if (trx.category === "Tabungan" && trx.type === "expense") return sum + Number(trx.amount);
    if (trx.category === "Penarikan Tabungan" && trx.type === "income") return sum - Number(trx.amount);
    return sum;
  }, 0);

  const sortedPeriodsForChart = [...availablePeriods].reverse();
  const CHART_MAX_LIMIT = 11000000;

  const kelolaPeriodTrx = kelolaPeriod === "SEMUA" 
    ? riwayat 
    : riwayat.filter(trx => getPeriodFromDate(trx.tanggal || trx.created_at) === kelolaPeriod);

  const groupedTransactions = kelolaPeriodTrx.reduce((groups: Record<string, any[]>, trx) => {
    const dateKey = trx.tanggal || trx.created_at.split('T')[0];
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(trx);
    return groups;
  }, {});

  const sortedDates = Object.keys(groupedTransactions).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  return (
    <main className="w-full max-w-md mx-auto flex flex-col items-center mt-6 p-5 bg-[#faf9f6] rounded-3xl shadow-sm border border-stone-200 mb-10 min-h-screen text-stone-800 font-sans">
      <div className="text-center mb-6">
        <h1 className="text-xl font-extrabold text-stone-700 leading-snug tracking-tight">
          Aplikasi Keuangan Keluarga
        </h1>
        <p className="text-xs font-semibold text-stone-400 mt-1 uppercase tracking-wider">
          Oleh: Roy Simarmata
        </p>
      </div>
      
      {/* Kartu Saldo Global & Arus Kas Bulan Berjalan */}
      <div className="w-full mb-6 bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 text-center border-b border-stone-100">
          <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">Saldo Gabungan</p>
          <p className={`text-4xl font-black tracking-tight ${saldo >= 0 ? 'text-[#5d7a5b]' : 'text-[#a85a4f]'}`}>
            Rp {saldo.toLocaleString("id-ID")}
          </p>
        </div>
        
        <div className="p-3 text-center bg-stone-50">
          <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-1">Sisa Bulan Ini (Per. {formatPeriodDisplay(CURRENT_PERIOD)})</p>
          <p className={`text-2xl font-bold tracking-tight ${saldoPeriodeIni >= 0 ? 'text-[#6a8b8c]' : 'text-[#a85a4f]'}`}>
            Rp {saldoPeriodeIni.toLocaleString("id-ID")}
          </p>
        </div>

        <div className="flex justify-between items-center bg-[#fdfaf5] border-t border-stone-100 p-3">
          <div className="flex flex-col items-center w-1/2 px-2 border-r border-stone-200">
            <span className="text-[10px] text-stone-500 font-semibold uppercase text-center">Pemasukan</span>
            <span className="text-sm font-bold text-[#5d7a5b] mt-0.5 text-center">+ Rp {totalPemasukanBulanIni.toLocaleString("id-ID")}</span>
          </div>
          <div className="flex flex-col items-center w-1/2 px-2">
            <span className="text-[10px] text-stone-500 font-semibold uppercase text-center">Pengeluaran</span>
            <span className="text-sm font-bold text-[#a85a4f] mt-0.5 text-center">- Rp {totalPengeluaranBulanIni.toLocaleString("id-ID")}</span>
          </div>
        </div>
      </div>

      {/* Navigasi 4 Tab */}
      <div className="grid grid-cols-4 gap-1 w-full mb-6 bg-stone-100 rounded-xl p-1.5 border border-stone-200 shadow-inner">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`py-2 text-[11px] font-bold transition-all duration-300 ${activeTab === 'dashboard' ? 'bg-white text-stone-800 rounded-lg shadow-sm border border-stone-200' : 'text-stone-500 hover:text-stone-700'}`}
        >
          📊 Analisis
        </button>
        <button
          onClick={() => setActiveTab("tabungan")}
          className={`py-2 text-[11px] font-bold transition-all duration-300 ${activeTab === 'tabungan' ? 'bg-white text-stone-800 rounded-lg shadow-sm border border-stone-200' : 'text-stone-500 hover:text-stone-700'}`}
        >
          💎 Tabungan
        </button>
        <button
          onClick={() => setActiveTab("chart")}
          className={`py-2 text-[11px] font-bold transition-all duration-300 ${activeTab === 'chart' ? 'bg-white text-stone-800 rounded-lg shadow-sm border border-stone-200' : 'text-stone-500 hover:text-stone-700'}`}
        >
          📈 Grafik
        </button>
        <button
          onClick={() => setActiveTab("transaksi")}
          className={`py-2 text-[11px] font-bold transition-all duration-300 ${activeTab === 'transaksi' ? 'bg-white text-stone-800 rounded-lg shadow-sm border border-stone-200' : 'text-stone-500 hover:text-stone-700'}`}
        >
          ✍️ Kelola
        </button>
      </div>

      {/* ================= TAB 1: ANALISIS ================= */}
      {activeTab === "dashboard" && (
        <div className="w-full space-y-4 animate-fade-in">
          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-semibold text-stone-500">Periode:</span>
              <select 
                value={selectedPeriod} 
                onChange={(e) => {
                  setSelectedPeriod(e.target.value);
                  setExpandedCategory(null);
                  setIsEditingBudget(false);
                }}
                className="bg-[#fcfbf9] text-stone-700 text-sm font-medium border border-stone-300 rounded-lg p-1.5 focus:outline-none focus:border-stone-400 cursor-pointer"
              >
                {availablePeriods.map(p => (
                  <option key={p} value={p}>{formatPeriodDisplay(p)} {p === CURRENT_PERIOD ? "(Aktif)" : ""}</option>
                ))}
              </select>
            </div>
            
            <div className="border-t border-stone-100 pt-3 grid grid-cols-2 gap-2 mb-3 bg-[#fdfaf5] p-2.5 rounded-xl border border-stone-100">
              <div>
                <p className="text-[10px] font-semibold text-stone-400 uppercase">Pemasukan Periode</p>
                <p className="text-sm font-bold text-[#5d7a5b]">+ Rp {selectedPeriodIncome.toLocaleString("id-ID")}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-stone-400 uppercase">Pengeluaran Periode</p>
                <p className="text-sm font-bold text-[#a85a4f]">- Rp {selectedPeriodExpense.toLocaleString("id-ID")}</p>
              </div>
            </div>

            <div className="border-t border-stone-100 pt-3 flex justify-between items-end">
              <div>
                <p className="text-[11px] text-stone-400 font-medium mb-1">{new Date(selStart).toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'numeric'})} - {new Date(selEnd).toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'numeric'})}</p>
                <p className="text-xs text-stone-500 font-semibold">Status Arus Kas: <span className={selectedPeriodIncome - selectedPeriodExpense >= 0 ? 'text-[#5d7a5b] font-bold' : 'text-[#a85a4f] font-bold'}>Rp {(selectedPeriodIncome - selectedPeriodExpense).toLocaleString("id-ID")}</span></p>
              </div>
              {!isEditingBudget && (
                <button onClick={openBudgetEdit} className="text-xs bg-[#f4ebd9] hover:bg-[#ebdcc2] text-[#8a7653] font-bold py-1.5 px-3 rounded-lg border border-[#e8d5b5] transition-colors">
                  Atur Limit
                </button>
              )}
            </div>
          </div>

          {isEditingBudget ? (
            <div className="bg-white p-5 rounded-2xl border border-stone-200 space-y-4 shadow-sm">
              <p className="text-sm text-[#8a7653] mb-2 font-bold">Target {formatPeriodDisplay(selectedPeriod)}:</p>
              {KATEGORI_BUDGET.map(cat => (
                <div key={cat} className="flex items-center gap-3">
                  <label className="w-1/3 text-xs font-semibold text-stone-600 flex items-center gap-1.5">
                    <span>{CATEGORY_ICONS[cat] || "📌"}</span> {cat}
                  </label>
                  <div className="relative w-2/3">
                    <span className="absolute left-3 top-2.5 text-stone-400 text-xs font-semibold">Rp</span>
                    <input
                      type="text"
                      value={budgetInputs[cat] ? new Intl.NumberFormat("id-ID").format(Number(budgetInputs[cat])) : ""}
                      onChange={(e) => handleBudgetChange(cat, e.target.value)}
                      className="w-full py-2 pl-8 pr-3 bg-stone-50 border border-stone-300 rounded-xl text-stone-700 text-sm focus:outline-none"
                    />
                  </div>
                </div>
              ))}
              <div className="flex gap-3 mt-5">
                <button onClick={() => setIsEditingBudget(false)} className="flex-1 py-2.5 text-sm bg-stone-200 text-stone-600 font-bold rounded-xl">Batal</button>
                <button onClick={saveBudgets} disabled={loading} className="flex-1 py-2.5 text-sm bg-[#786b5c] text-white rounded-xl font-bold">Simpan</button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {KATEGORI_BUDGET.map(cat => {
                const limit = budgets.find(b => b.periode === selectedPeriod && b.category === cat)?.amount || 0;
                
                const catTransactions = selectedPeriodTrx.filter(t => {
                  if (t.type !== "expense") return false;
                  const c = (t.category || "").trim().toLowerCase();
                  if (cat === "Makanan dan Harian") {
                    return c === "makanan dan harian" || c === "makanan & harian" || c === "makanan harian";
                  }
                  if (cat === "Insidentil & Aset") {
                    return c === "insidentil & aset" || c === "insidentil dan aset" || c === "insidentil";
                  }
                  return c === cat.toLowerCase();
                });

                const spent = catTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
                
                const percentage = limit > 0 ? (spent / limit) * 100 : 0;
                const barWidth = Math.min(percentage, 100);
                const isExpanded = expandedCategory === cat;

                return (
                  <div key={cat} className="bg-white rounded-2xl border border-stone-200 overflow-hidden transition-all shadow-sm">
                    <div 
                      onClick={() => setExpandedCategory(isExpanded ? null : cat)}
                      className="p-4 cursor-pointer hover:bg-stone-50 transition-colors"
                    >
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-sm font-bold text-stone-700 flex items-center gap-2">
                          <span className="text-base">{CATEGORY_ICONS[cat] || "📌"}</span> {cat}
                          <svg className={`w-4 h-4 text-stone-400 transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </span>
                        <span className="text-xs font-bold text-stone-500">{percentage.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-stone-100 rounded-full h-2 mb-2 border border-stone-200 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-700 ease-out ${percentage > 100 ? 'bg-[#b85042]' : 'bg-[#8a9e7f]'}`} 
                          style={{ width: `${barWidth}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-[10px] text-stone-500 font-semibold">
                        <span>Rp {spent.toLocaleString("id-ID")}</span>
                        <span>Batas: Rp {limit.toLocaleString("id-ID")}</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="bg-[#fcfbf9] border-t border-stone-100 p-4 space-y-3">
                        {catTransactions.length === 0 ? (
                          <p className="text-xs text-stone-400 text-center py-2 italic font-medium">Belum ada pengeluaran.</p>
                        ) : (
                          catTransactions.map(trx => (
                            <div key={trx.id} className="flex justify-between items-start text-xs border-b border-stone-200 pb-2.5 last:border-0 last:pb-0">
                              <div>
                                <p className="text-stone-700 font-semibold mb-0.5">{trx.description}</p>
                                <p className="text-stone-400 font-medium flex items-center gap-1">
                                  {new Date(trx.tanggal || trx.created_at).toLocaleDateString("id-ID", { day: 'numeric', month: 'short' })} 
                                  <span className="opacity-50">•</span> 
                                  {trx.penginput === 'Suami' ? '👨' : '👩'}
                                </p>
                              </div>
                              <span className="text-[#a85a4f] font-bold whitespace-nowrap bg-[#f9ebe9] px-2 py-0.5 rounded-md">- Rp {Number(trx.amount).toLocaleString("id-ID")}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 2: TABUNGAN ================= */}
      {activeTab === "tabungan" && (
        <div className="w-full space-y-4 animate-fade-in">
          <div className="bg-gradient-to-br from-[#ebe1ce] via-[#f7f4ec] to-white p-7 rounded-3xl border border-[#d6cebf] text-center shadow-sm relative overflow-hidden group">
            <div className="absolute -top-4 -right-4 text-8xl opacity-10 transform group-hover:scale-110 transition-transform duration-500">💎</div>
            <p className="text-xs text-[#8a7653] mb-2 font-bold tracking-widest uppercase relative z-10">Total Aset Tabungan</p>
            <p className="text-4xl md:text-5xl font-black text-stone-800 relative z-10">
              Rp {totalTabungan.toLocaleString("id-ID")}
            </p>
          </div>

          <h2 className="text-xs font-bold text-stone-500 uppercase tracking-widest border-b border-stone-200 pb-2 mt-2">Akumulasi Tabungan Per Bulan</h2>
          <div className="space-y-3">
            {availablePeriods.map(period => {
              const tabunganInPeriod = allTabunganTrx.filter(t => getPeriodFromDate(t.tanggal || t.created_at) === period);
              const sumInPeriod = tabunganInPeriod.reduce((sum, t) => {
                const c = (t.category || "").trim().toLowerCase();
                if (c === "tabungan" && t.type === "expense") return sum + Number(t.amount);
                if (c === "penarikan tabungan" && t.type === "income") return sum - Number(t.amount);
                return sum;
              }, 0);
              
              if (sumInPeriod === 0) return null;

              return (
                <div key={period} className="bg-white p-4 rounded-2xl border border-stone-200 flex justify-between items-center shadow-sm">
                  <div>
                    <p className="text-sm font-bold text-stone-700">{formatPeriodDisplay(period)}</p>
                    <p className="text-[11px] text-stone-400 font-semibold mt-0.5">{tabunganInPeriod.length} mutasi tabungan</p>
                  </div>
                  <p className="font-bold text-[#5d7a5b] bg-[#eaf0ea] px-3 py-1 rounded-lg border border-[#c6d6c6]">+ Rp {sumInPeriod.toLocaleString("id-ID")}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= TAB 3: GRAFIK ================= */}
      {activeTab === "chart" && (
        <div className="w-full space-y-4 animate-fade-in">
          <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-sm space-y-4">
            <div>
              <h2 className="text-sm font-bold text-stone-700">Grafik Arus Kas Bulanan</h2>
              <p className="text-[11px] text-stone-400">Perbandingan pemasukan dan pengeluaran (Maks. Skala Rp 11 Juta)</p>
            </div>

            <div className="space-y-4 pt-2">
              {sortedPeriodsForChart.map(period => {
                const pTrx = riwayat.filter(t => getPeriodFromDate(t.tanggal || t.created_at) === period);
                const inc = pTrx.filter(t => t.type === "income" && t.category !== "Penarikan Tabungan").reduce((s, t) => s + Number(t.amount), 0);
                const exp = pTrx.filter(t => t.type === "expense" && t.category !== "Tabungan").reduce((s, t) => s + Number(t.amount), 0);
                
                const incPct = Math.min((inc / CHART_MAX_LIMIT) * 100, 100);
                const expPct = Math.min((exp / CHART_MAX_LIMIT) * 100, 100);

                return (
                  <div key={period} className="bg-stone-50 p-3.5 rounded-2xl border border-stone-100 space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold text-stone-700 border-b border-stone-200 pb-1.5">
                      <span>{formatPeriodDisplay(period)}</span>
                      <span className={inc - exp >= 0 ? 'text-[#5d7a5b]' : 'text-[#a85a4f]'}>
                        Selisih: Rp {(inc - exp).toLocaleString("id-ID")}
                      </span>
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] font-semibold text-stone-500 mb-0.5">
                        <span>Pemasukan</span>
                        <span className="text-[#5d7a5b]">+ Rp {inc.toLocaleString("id-ID")}</span>
                      </div>
                      <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                        <div className="bg-[#5d7a5b] h-full rounded-full transition-all duration-500" style={{ width: `${incPct}%` }}></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] font-semibold text-stone-500 mb-0.5">
                        <span>Pengeluaran</span>
                        <span className="text-[#a85a4f]">- Rp {exp.toLocaleString("id-ID")}</span>
                      </div>
                      <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                        <div className="bg-[#a85a4f] h-full rounded-full transition-all duration-500" style={{ width: `${expPct}%` }}></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 4: KELOLA TRANSAKSI ================= */}
      {activeTab === "transaksi" && (
        <div className="w-full animate-fade-in">
          <form onSubmit={handleSubmitTrx} className="w-full space-y-4 mb-8 bg-white p-5 rounded-3xl border border-stone-200 shadow-sm">
            {editId && (
              <div className="flex justify-between items-center mb-2 bg-[#faecc3] p-2 rounded-lg border border-[#ebd89e]">
                <span className="text-xs font-bold text-[#9e7d23] flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                  Mode Edit
                </span>
                <button type="button" onClick={cancelEdit} className="text-xs font-bold text-[#b85042] hover:text-[#8f3a2f] transition-colors">Batal</button>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setType("income"); setCategory(""); }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 border ${type === 'income' ? 'bg-[#f0f4f0] text-[#4b7a47] border-[#c0d6c0]' : 'bg-stone-50 text-stone-400 border-stone-200 hover:bg-stone-100'}`}
              >
                + Pemasukan
              </button>
              <button
                type="button"
                onClick={() => { setType("expense"); setCategory("Makanan dan Harian"); }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 border ${type === 'expense' ? 'bg-[#fcf1ef] text-[#b85042] border-[#ebd1cd]' : 'bg-stone-50 text-stone-400 border-stone-200 hover:bg-stone-100'}`}
              >
                - Pengeluaran
              </button>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPenginput("Suami")}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all duration-300 border ${penginput === 'Suami' ? 'bg-[#f4eedb] text-[#8f773f] border-[#ebdca9]' : 'bg-stone-50 text-stone-500 border-stone-200'}`}
              >
                👨 Suami
              </button>
              <button
                type="button"
                onClick={() => setPenginput("Istri")}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all duration-300 border ${penginput === 'Istri' ? 'bg-[#f5eef0] text-[#9c6a7a] border-[#ebd6dc]' : 'bg-stone-50 text-stone-500 border-stone-200'}`}
              >
                👩 Istri
              </button>
            </div>

            <div className="flex gap-3">
              <input
                type="date"
                required
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-[45%] p-3 bg-stone-50 border border-stone-300 rounded-xl text-stone-700 focus:outline-none text-sm font-medium transition-all"
              />
              <div className="relative w-[55%]">
                <span className="absolute left-3 top-3 text-stone-400 font-bold">Rp</span>
                <input
                  type="text"
                  required
                  placeholder="0"
                  value={amount}
                  onChange={handleAmountChange}
                  className="w-full py-3 pl-10 pr-3 bg-stone-50 border border-stone-300 rounded-xl text-stone-800 focus:outline-none transition-all font-bold"
                />
              </div>
            </div>

            <div>
              <select
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-3 bg-stone-50 border border-stone-300 rounded-xl text-stone-700 focus:outline-none appearance-none transition-all font-semibold cursor-pointer"
              >
                <option value="" disabled>-- Pilih Kategori --</option>
                {type === "income" ? (
                  <>
                    <option value="Gaji Perusahaan">💼 Gaji Perusahaan</option>
                    <option value="Bonus/THR">🎁 Bonus/THR</option>
                    <option value="Pekerjaan Lain">🚀 Pekerjaan Lain</option>
                    <option value="Penarikan Tabungan">📥 Penarikan Tabungan</option>
                  </>
                ) : (
                  KATEGORI_BUDGET.map(cat => (
                    <option key={cat} value={cat}>
                      {CATEGORY_ICONS[cat] || "📌"} {cat}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <input
                type="text"
                required
                placeholder="Uraian (Misal: Token Listrik)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-3 bg-stone-50 border border-stone-300 rounded-xl text-stone-700 focus:outline-none transition-all text-sm font-medium placeholder-stone-400"
              />
            </div>

            <button type="submit" disabled={loading} className={`w-full py-3.5 rounded-xl text-white font-bold tracking-wide transition-all duration-300 ${editId ? 'bg-[#c29642] hover:bg-[#a67f33]': 'bg-[#786b5c] hover:bg-[#5e5447]'} ${loading ? 'opacity-70 scale-95' : 'hover:-translate-y-0.5 shadow-sm'}`}>
              {loading ? "Menyimpan..." : editId ? "Simpan Pembaruan" : "Simpan Transaksi"}
            </button>
          </form>

          <div className="flex justify-between items-center mb-4 border-b border-stone-200 pb-2">
            <h2 className="text-sm font-bold text-stone-600 uppercase tracking-wider">Riwayat Transaksi</h2>
            <select
              value={kelolaPeriod}
              onChange={(e) => setKelolaPeriod(e.target.value)}
              className="bg-white text-stone-700 text-xs font-bold border border-stone-300 rounded-lg p-1.5 focus:outline-none cursor-pointer shadow-sm"
            >
              <option value="SEMUA">Semua Riwayat</option>
              {availablePeriods.map(p => (
                <option key={p} value={p}>Periode {formatPeriodDisplay(p)}</option>
              ))}
            </select>
          </div>
          
          <div className="space-y-4">
            {sortedDates.length === 0 ? (
              <div className="text-center py-10 bg-stone-50 rounded-2xl border border-stone-200 border-dashed">
                <p className="text-stone-400 text-sm font-semibold">Tidak ada transaksi di periode ini.</p>
              </div>
            ) : (
              sortedDates.map((dateKey) => {
                const dayTransactions = groupedTransactions[dateKey];
                const formattedDateHeader = new Date(dateKey).toLocaleDateString("id-ID", {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                });

                return (
                  <div key={dateKey} className="space-y-2">
                    <div className="bg-[#f2ece1] px-3.5 py-1.5 rounded-xl border border-[#e3d7c7] flex justify-between items-center">
                      <span className="text-xs font-bold text-[#7a6a53] tracking-wide">📅 {formattedDateHeader}</span>
                      <span className="text-[10px] font-bold text-[#8a7653] bg-white/70 px-2 py-0.5 rounded-md">
                        {dayTransactions.length} transaksi
                      </span>
                    </div>

                    <div className="space-y-2 pl-1">
                      {dayTransactions.map((trx) => (
                        <div key={trx.id} className="flex justify-between items-start p-3.5 bg-white rounded-2xl border border-stone-200 hover:border-stone-300 transition-colors shadow-sm group">
                          <div className="flex-1 pr-2">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-bold text-stone-700 flex items-center gap-1.5">
                                <span>{CATEGORY_ICONS[trx.category] || "📌"}</span> {trx.category}
                              </p>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${trx.penginput === 'Suami' ? 'bg-[#f4eedb] text-[#8f773f] border-[#ebdca9]' : 'bg-[#f5eef0] text-[#9c6a7a] border-[#ebd6dc]'}`}>
                                {trx.penginput === 'Suami' ? '👨 Suami' : '👩 Istri'}
                              </span>
                            </div>
                            <p className="text-xs text-stone-500 font-semibold line-clamp-1">{trx.description}</p>
                          </div>
                          
                          <div className="flex flex-col items-end gap-1.5">
                            <p className={`font-black text-sm whitespace-nowrap ${trx.type === 'income' ? 'text-[#5d7a5b] font-extrabold' : 'text-[#a85a4f]'}`}>
                              {trx.type === 'income' ? '+' : '-'} Rp {Number(trx.amount).toLocaleString("id-ID")}
                            </p>
                            <div className="flex gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEdit(trx)} className="text-[10px] font-bold px-2.5 py-1 bg-stone-100 border border-stone-200 text-stone-600 rounded-lg hover:bg-stone-200 transition-colors">Edit</button>
                              <button onClick={() => handleDelete(trx.id)} className="text-[10px] font-bold px-2.5 py-1 bg-[#fcf1ef] border border-[#ebd1cd] text-[#b85042] rounded-lg hover:bg-[#f2dfdb] transition-colors">Hapus</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </main>
  );
}