import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus, Search, Pencil, Trash2, Clock, X, Check,
  Waves, CalendarDays, Wallet, Users, AlertCircle, RotateCcw, History,
  ChevronDown, MessageCircle, Settings, Copy, Lock, Delete,
  ShieldCheck, UserCog, GraduationCap, ChevronRight, LogOut,
} from "lucide-react";
import { dadosRef } from "./firebase";
import { onValue, get, set } from "firebase/database";

const C = {
  deep: "#075E76", water: "#0E9FBF", aqua: "#2DD4BF", tint: "#EAF7FA",
  ink: "#0A2A33", sub: "#5B7C85", paid: "#0E9F6E", due: "#E8820C",
  line: "#D4E9EE", card: "#FFFFFF",
};

const NIVEIS = ["Adaptação", "Iniciante", "Intermediário", "Avançado", "Hidroginástica"];
const PROFESSORES = ["George", "Ana Beatriz", "Rosângela"];
const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const HORARIOS = (() => {
  const out = [];
  for (let h = 6; h <= 21; h++) {
    out.push(`${String(h).padStart(2, "0")}h`);
    if (h < 21) out.push(`${String(h).padStart(2, "0")}h30`);
  }
  return out;
})();

const KEY_MODO = "natacao:modo";
const KEY_PROF = "natacao:prof";

const brl = (n) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const labelMes = (r) => `${MESES[r.mes]} de ${r.ano}`;
const proximoMes = (r) => (r.mes === 11 ? { ano: r.ano + 1, mes: 0 } : { ano: r.ano, mes: r.mes + 1 });

const crc16 = (str) => {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
};
const emv = (id, value) => `${id}${String(value.length).padStart(2, "0")}${value}`;
const limpaTexto = (s, max) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9 ]/g, "").trim().slice(0, max) || "";
const chaveFormatada = (chave, tipo) => {
  const c = (chave || "").trim();
  if (tipo === "Telefone") { let d = c.replace(/\D/g, ""); if (!d.startsWith("55")) d = "55" + d; return "+" + d; }
  if (tipo === "CPF") return c.replace(/\D/g, "");
  if (tipo === "E-mail") return c.toLowerCase();
  return c;
};
const pixCopiaCola = ({ chave, tipo, nome, cidade, valor }) => {
  if (!chave) return "";
  const mai = emv("26", emv("00", "br.gov.bcb.pix") + emv("01", chaveFormatada(chave, tipo)));
  const nomeF = limpaTexto(nome, 25) || "AMOC";
  const cidadeF = limpaTexto(cidade, 15) || "BRASIL";
  let p = emv("00", "01") + mai + emv("52", "0000") + emv("53", "986");
  if (valor && Number(valor) > 0) p += emv("54", Number(valor).toFixed(2));
  p += emv("58", "BR") + emv("59", nomeF) + emv("60", cidadeF) + emv("62", emv("05", "*"));
  p += "6304";
  return p + crc16(p);
};
const formatTel = (v) => {
  const d = (v || "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const emptyForm = { nome: "", contato: "", nivel: "Iniciante", professor: "George", dias: "", horario: "", mensalidade: "", vencimento: "", obs: "" };
const emptyConfig = { pixChave: "", pixNome: "", pixTipo: "Telefone", pixCidade: "", pin: "", pergunta: "", resposta: "" };

function Stat({ icon, label, value, tone }) {
  return (
    <div className="rounded-2xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.16)" }}>
      <div className="flex items-center gap-1.5 text-white/70 text-xs mb-0.5">{icon} {label}</div>
      <div className="font-bold text-white text-sm" style={tone ? { color: tone } : {}}>{value}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1.5" style={{ color: C.sub }}>{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, inputMode, inputRef }) {
  return (
    <input ref={inputRef} value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder} inputMode={inputMode}
      className="w-full px-3 py-2.5 rounded-xl outline-none text-sm"
      style={{ background: C.tint, border: `1px solid ${C.line}`, color: C.ink }} />
  );
}

export default function App() {
  const [alunos, setAlunos] = useState([]);
  const [ref, setRef] = useState({ ano: new Date().getFullYear(), mes: new Date().getMonth() });
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [filtroProf, setFiltroProf] = useState("todos");
  const [filtroNivel, setFiltroNivel] = useState("todos");
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmReset, setConfirmReset] = useState(false);
  const [excluirId, setExcluirId] = useState(null);
  const [salvo, setSalvo] = useState(false);
  const [erroNome, setErroNome] = useState(false);
  const [msgFechado, setMsgFechado] = useState("");
  const [editarMes, setEditarMes] = useState(false);
  const [mesDetalhe, setMesDetalhe] = useState(null);
  const [config, setConfig] = useState(emptyConfig);
  const [verConfig, setVerConfig] = useState(false);
  const [copiadoId, setCopiadoId] = useState(null);
  const [tmpConfig, setTmpConfig] = useState(emptyConfig);
  const [tmpRef, setTmpRef] = useState({ ano: new Date().getFullYear(), mes: new Date().getMonth() });
  const [modo, setModo] = useState(null);
  const [profAtual, setProfAtual] = useState("");
  const [admin, setAdmin] = useState(true);
  const [verPin, setVerPin] = useState(false);
  const [pinDigitado, setPinDigitado] = useState("");
  const [pinErro, setPinErro] = useState(false);
  const [modoPin, setModoPin] = useState("verificar");
  const [recuperar, setRecuperar] = useState(false);
  const [respInput, setRespInput] = useState("");
  const [respErro, setRespErro] = useState(false);
  const [pinRevelado, setPinRevelado] = useState("");
  const [verHistorico, setVerHistorico] = useState(false);
  const [quickEdit, setQuickEdit] = useState(null); // { id, field, value }
  const fieldsRef = useRef(null);
  const nomeRef = useRef(null);
  const isFirstLoad = useRef(true);

  const ehProf = modo === "prof";

  const toggleDia = (d) => {
    const atuais = form.dias ? form.dias.split("/").filter(Boolean) : [];
    const novos = atuais.includes(d) ? atuais.filter((x) => x !== d) : [...atuais, d];
    setForm({ ...form, dias: DIAS_SEMANA.filter((x) => novos.includes(x)).join("/") });
  };

  // Configurações locais do aparelho
  useEffect(() => {
    const savedModo = localStorage.getItem(KEY_MODO);
    const savedProf = localStorage.getItem(KEY_PROF);
    if (savedModo) setModo(savedModo);
    if (savedProf) { setProfAtual(savedProf); setFiltroProf(savedProf); }
  }, []);

  // Listener em tempo real do Firebase
  useEffect(() => {
    const unsubscribe = onValue(dadosRef, (snapshot) => {
      const d = snapshot.val();
      if (d) {
        setAlunos(d.alunos || []);
        if (d.ref && typeof d.ref.mes === "number") setRef(d.ref);
        setHistorico(d.historico || []);
        if (d.config) {
          const cfg = { ...emptyConfig, ...d.config };
          setConfig(cfg);
          if (isFirstLoad.current && cfg.pin) setAdmin(false);
        }
      }
      isFirstLoad.current = false;
      setLoading(false);
    }, () => setLoading(false));
    return () => unsubscribe();
  }, []);

  const flashSalvo = () => { setSalvo(true); setTimeout(() => setSalvo(false), 1500); };

  const persist = async (novosAlunos, novoRef = ref, novoHist = historico, novoConfig = config) => {
    setAlunos(novosAlunos); setRef(novoRef); setHistorico(novoHist); setConfig(novoConfig);
    try {
      await set(dadosRef, { alunos: novosAlunos, ref: novoRef, historico: novoHist, config: novoConfig });
      flashSalvo();
    } catch (e) { console.error(e); }
  };

  const commitAlunos = async (transform) => {
    try {
      const snap = await get(dadosRef);
      const base = snap.val() || { alunos: [], ref, historico, config };
      const novos = transform(base.alunos || []);
      const payload = { ...base, alunos: novos };
      await set(dadosRef, payload);
      setAlunos(novos);
      if (payload.ref) setRef(payload.ref);
      if (payload.historico) setHistorico(payload.historico);
      if (payload.config) setConfig({ ...emptyConfig, ...payload.config });
      flashSalvo();
    } catch (e) { console.error(e); }
  };

  const irModo = (m) => {
    setModo(m);
    setBusca(""); setFiltro("todos"); setFiltroProf("todos"); setFiltroNivel("todos");
    if (m === "adm") setAdmin(!config.pin);
    localStorage.setItem(KEY_MODO, m);
  };
  const escolherProfessor = (p) => {
    setProfAtual(p); setFiltroProf(p);
    localStorage.setItem(KEY_PROF, p);
  };
  const trocarAcesso = () => {
    setModo(null); setAdmin(false); setVerConfig(false); setVerHistorico(false);
    localStorage.removeItem(KEY_MODO);
  };

  const abrirPin = () => { setModoPin("verificar"); setPinDigitado(""); setPinErro(false); setVerPin(true); };
  const exigeAdmin = () => { if (admin) return true; abrirPin(); return false; };
  const onCadeado = () => {
    if (!config.pin) { setModoPin("definir"); setPinDigitado(""); setPinErro(false); setVerPin(true); return; }
    if (admin) { setAdmin(false); } else abrirPin();
  };
  const digitarPin = (d) => {
    if (pinDigitado.length >= 4) return;
    const novo = pinDigitado + d;
    setPinErro(false); setPinDigitado(novo);
    if (novo.length === 4) setTimeout(() => finalizarPin(novo), 120);
  };
  const finalizarPin = (valor) => {
    if (modoPin === "definir") {
      persist(alunos, ref, historico, { ...config, pin: valor });
      setAdmin(true); setVerPin(false); setPinDigitado("");
    } else {
      if (valor === config.pin) { setAdmin(true); setVerPin(false); setPinDigitado(""); }
      else { setPinErro(true); setPinDigitado(""); }
    }
  };
  const apagarPin = () => setPinDigitado((p) => p.slice(0, -1));
  const cancelarPin = () => { setVerPin(false); setPinDigitado(""); setPinErro(false); };
  const removerSenha = () => { persist(alunos, ref, historico, { ...config, pin: "" }); setAdmin(true); };
  const alterarSenha = () => { setVerConfig(false); setModoPin("definir"); setPinDigitado(""); setPinErro(false); setVerPin(true); };

  const salvarPergunta = () => persist(alunos, ref, historico, { ...config, pergunta: (tmpConfig.pergunta || "").trim(), resposta: (tmpConfig.resposta || "").trim() });
  const confirmarResposta = () => {
    const r = (respInput || "").trim().toLowerCase();
    const certo = (config.resposta || "").trim().toLowerCase();
    if (r && certo && r === certo) { setPinRevelado(config.pin); setRespErro(false); } else setRespErro(true);
  };
  const abrirRecuperar = () => { setRecuperar(true); setRespInput(""); setRespErro(false); setPinRevelado(""); };
  const fecharRecuperar = () => { setRecuperar(false); setRespInput(""); setRespErro(false); setPinRevelado(""); };
  const entrarRecuperacao = () => { setAdmin(true); setRecuperar(false); setRespInput(""); setRespErro(false); setPinRevelado(""); setPinDigitado(""); };

  const abrirNovo = () => {
    if (!ehProf && !exigeAdmin()) return;
    setForm({ ...emptyForm, professor: ehProf ? profAtual : PROFESSORES[0] });
    setEditId(null); setErroNome(false); setModal(true);
  };
  const abrirEdicao = (a) => {
    if (!ehProf && !exigeAdmin()) return;
    setForm({
      nome: a.nome, contato: a.contato, nivel: a.nivel, professor: a.professor || PROFESSORES[0],
      dias: a.dias, horario: a.horario, mensalidade: String(a.mensalidade ?? ""), vencimento: String(a.vencimento ?? ""), obs: a.obs || "",
    });
    setEditId(a.id); setErroNome(false); setModal(true);
  };
  const salvar = () => {
    if (!form.nome || !form.nome.trim()) {
      setErroNome(true);
      if (fieldsRef.current) fieldsRef.current.scrollTo({ top: 0, behavior: "smooth" });
      if (nomeRef.current) setTimeout(() => nomeRef.current && nomeRef.current.focus(), 300);
      return;
    }
    setErroNome(false);
    const comum = {
      nome: form.nome.trim(), contato: form.contato.trim(), nivel: form.nivel,
      dias: form.dias.trim(), horario: form.horario.trim(), obs: form.obs.trim(),
    };
    if (ehProf) {
      const dados = { ...comum, professor: profAtual };
      if (editId) commitAlunos((l) => l.map((a) => (a.id === editId ? { ...a, ...dados } : a)));
      else commitAlunos((l) => [...l, { id: Date.now(), pago: false, mensalidade: 0, vencimento: "", ...dados }]);
    } else {
      const dados = {
        ...comum, professor: form.professor,
        mensalidade: parseFloat(String(form.mensalidade).replace(",", ".")) || 0,
        vencimento: parseInt(form.vencimento) || "",
      };
      if (editId) commitAlunos((l) => l.map((a) => (a.id === editId ? { ...a, ...dados } : a)));
      else commitAlunos((l) => [...l, { id: Date.now(), pago: false, ...dados }]);
    }
    setBusca(""); setFiltro("todos"); if (!ehProf) setFiltroProf("todos"); setModal(false);
  };
  const excluir = (id) => commitAlunos((l) => l.filter((a) => a.id !== id));
  const confirmarExcluir = () => { if (excluirId != null) excluir(excluirId); setExcluirId(null); };
  const togglePago = (id) => { if (!exigeAdmin()) return; commitAlunos((l) => l.map((a) => (a.id === id ? { ...a, pago: !a.pago } : a))); };

  const salvarQuickEdit = () => {
    if (!quickEdit) return;
    const { id, field, value } = quickEdit;
    setQuickEdit(null);
    const parsed = field === "mensalidade" ? parseFloat(String(value).replace(",", ".")) || 0 : value;
    commitAlunos((l) => l.map((a) => a.id === id ? { ...a, [field]: parsed } : a));
  };

  const fecharMes = () => {
    const previsto = alunos.reduce((s, a) => s + (Number(a.mensalidade) || 0), 0);
    const recebido = alunos.filter((a) => a.pago).reduce((s, a) => s + (Number(a.mensalidade) || 0), 0);
    const snap = {
      id: Date.now(), mes: labelMes(ref), ano: ref.ano, mesNum: ref.mes, data: new Date().toISOString(),
      totalAlunos: alunos.length, qtdPagos: alunos.filter((a) => a.pago).length, previsto, recebido, pendente: previsto - recebido,
      alunosSnap: alunos.map((a) => ({ nome: a.nome, professor: a.professor, mensalidade: Number(a.mensalidade) || 0, pago: !!a.pago })),
    };
    const prox = proximoMes(ref);
    persist(alunos.map((a) => ({ ...a, pago: false })), prox, [snap, ...historico]);
    setConfirmReset(false);
    setMsgFechado(`${snap.mes} fechado — R$ ${recebido.toFixed(2)} salvo no histórico`);
    setTimeout(() => setMsgFechado(""), 3500);
  };

  const abrirEditarMes = () => { if (!exigeAdmin()) return; setTmpRef(ref); setEditarMes(true); };
  const definirMes = () => { persist(alunos, tmpRef); setEditarMes(false); };
  const abrirConfig = () => { if (!exigeAdmin()) return; setTmpConfig(config); setVerConfig(true); };
  const salvarConfig = () => {
    persist(alunos, ref, historico, {
      pixChave: tmpConfig.pixChave.trim(), pixNome: tmpConfig.pixNome.trim(), pixTipo: tmpConfig.pixTipo,
      pixCidade: tmpConfig.pixCidade.trim(), pin: config.pin, pergunta: config.pergunta, resposta: config.resposta,
    });
    setVerConfig(false);
  };

  const pixCola = (valor) => pixCopiaCola({ chave: config.pixChave, tipo: config.pixTipo, nome: config.pixNome, cidade: config.pixCidade, valor });
  const zapShare = (txt) => `https://wa.me/?text=${encodeURIComponent(txt)}`;
  const copiarPix = async (a) => {
    const codigo = pixCola(a.mensalidade);
    if (!codigo) return;
    try { await navigator.clipboard.writeText(codigo); } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = codigo; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (_) {}
      document.body.removeChild(ta);
    }
    setCopiadoId(a.id); setTimeout(() => setCopiadoId(null), 1800);
  };
  const textoPrestacao = (m) => {
    const fmt = (n) => `R$ ${(Number(n) || 0).toFixed(2).replace(".", ",")}`;
    const lista2 = m.alunosSnap || [];
    const pagos = lista2.filter((a) => a.pago);
    const naoPagos = lista2.filter((a) => !a.pago);
    let txt = `AMOC — Prestação de contas\n${m.mes}\n\n`;
    txt += `Recebido: ${fmt(m.recebido)} de ${fmt(m.previsto)}\nPagaram: ${m.qtdPagos}/${m.totalAlunos}\n\n`;
    if (pagos.length) { txt += `PAGARAM (${pagos.length}):\n`; pagos.forEach((a) => { txt += `• ${a.nome} — ${fmt(a.mensalidade)}\n`; }); txt += "\n"; }
    if (naoPagos.length) { txt += `PENDENTES (${naoPagos.length}):\n`; naoPagos.forEach((a) => { txt += `• ${a.nome} — ${fmt(a.mensalidade)}\n`; }); }
    if (config.pixChave) { txt += `\nChave PIX: ${config.pixChave}`; if (config.pixNome) txt += `\n${config.pixNome}`; }
    return txt;
  };
  const linkZap = (a, comCobranca) => {
    const num = (a.contato || "").replace(/\D/g, "");
    let url = `https://wa.me/55${num}`;
    if (comCobranca) {
      const venc = a.vencimento ? `, vencimento dia ${a.vencimento}` : "";
      let msg = `Olá ${a.nome}! 😊 Passando pra lembrar da mensalidade da natação no valor de ${brl(a.mensalidade)}${venc}.`;
      if (config.pixChave) {
        const copia = pixCola(a.mensalidade);
        msg += `\n\nPIX${config.pixNome ? ` (${config.pixNome})` : ""} — já com o valor de ${brl(a.mensalidade)}.`;
        msg += copia ? `\n\nÉ só copiar o código abaixo e colar no seu banco:\n${copia}` : `\n\nChave PIX:\n${config.pixChave}`;
      }
      msg += "\n\nQualquer dúvida, estou à disposição!";
      url += `?text=${encodeURIComponent(msg)}`;
    }
    return url;
  };

  const stats = useMemo(() => {
    const prevista = alunos.reduce((s, a) => s + (Number(a.mensalidade) || 0), 0);
    const recebido = alunos.filter((a) => a.pago).reduce((s, a) => s + (Number(a.mensalidade) || 0), 0);
    return { total: alunos.length, prevista, recebido, pendente: prevista - recebido, qtdPendente: alunos.filter((a) => !a.pago).length };
  }, [alunos]);

  const lista = useMemo(() => alunos
    .filter((a) => a.nome.toLowerCase().includes(busca.toLowerCase()))
    .filter((a) => filtroProf === "todos" || a.professor === filtroProf)
    .filter((a) => ehProf ? true : (filtro === "todos" || (filtro === "pago" ? a.pago : !a.pago)))
    .filter((a) => filtroNivel === "todos" || a.nivel === filtroNivel)
    .sort((a, b) => (ehProf ? 0 : Number(a.pago) - Number(b.pago)) || a.nome.localeCompare(b.nome)),
    [alunos, busca, filtro, filtroProf, filtroNivel, ehProf]);

  const porProfessor = useMemo(() =>
    PROFESSORES.map((p) => { const t = alunos.filter((a) => a.professor === p); return { nome: p, total: t.length, pendentes: t.filter((a) => !a.pago).length }; }), [alunos]);

  const anos = useMemo(() => {
    const s = new Set(historico.map((h) => h.ano).filter(Boolean)); s.add(ref.ano); return [...s].sort((a, b) => b - a);
  }, [historico, ref]);

  const dadosAno = (ano) => {
    const meses = historico.filter((h) => h.ano === ano).sort((a, b) => b.mesNum - a.mesNum);
    return { meses, recebido: meses.reduce((s, h) => s + (h.recebido || 0), 0), previsto: meses.reduce((s, h) => s + (h.previsto || 0), 0) };
  };
  const estaVencido = (a) => !a.pago && a.vencimento && new Date().getDate() > Number(a.vencimento);
  const vencidos = useMemo(() => alunos.filter(estaVencido).length, [alunos]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.tint }}>
        <Waves size={32} style={{ color: C.water }} className="animate-pulse" />
      </div>
    );
  }

  if (!modo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: `linear-gradient(160deg, ${C.deep}, ${C.water})` }}>
        <div className="w-full max-w-xs text-center">
          <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-3" style={{ background: "rgba(255,255,255,0.14)" }}>
            <Waves size={30} className="text-white" />
          </div>
          <h1 className="text-white text-2xl font-bold">Alunos AMOC</h1>
          <p className="text-white/70 text-sm mt-1 mb-7">Natação e Hidroginástica</p>
          <button type="button" onClick={() => irModo("prof")}
            className="w-full rounded-2xl p-4 mb-3 flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
            style={{ background: "#fff" }}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.tint }}><GraduationCap size={22} style={{ color: C.deep }} /></div>
            <div className="flex-1">
              <div className="font-bold" style={{ color: C.ink }}>Sou professor</div>
              <div className="text-xs" style={{ color: C.sub }}>Cadastrar alunos</div>
            </div>
            <ChevronRight size={18} style={{ color: C.sub }} />
          </button>
          <button type="button" onClick={() => irModo("adm")}
            className="w-full rounded-2xl p-4 flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
            style={{ background: "rgba(255,255,255,0.16)" }}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.18)" }}><Lock size={20} className="text-white" /></div>
            <div className="flex-1">
              <div className="font-bold text-white">Sou ADM</div>
              <div className="text-xs text-white/70">Financeiro · pede o PIN</div>
            </div>
            <ChevronRight size={18} className="text-white/70" />
          </button>
        </div>
      </div>
    );
  }

  if (modo === "prof" && !profAtual) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: `linear-gradient(160deg, ${C.deep}, ${C.water})` }}>
        <div className="w-full max-w-xs">
          <h2 className="text-white font-bold text-xl text-center mb-1">Quem é você?</h2>
          <p className="text-white/70 text-sm text-center mb-5">Fica salvo neste aparelho</p>
          <div className="space-y-2.5">
            {PROFESSORES.map((p) => (
              <button key={p} type="button" onClick={() => escolherProfessor(p)}
                className="w-full py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2"
                style={{ background: "#fff", color: C.ink }}>
                <UserCog size={17} style={{ color: C.deep }} /> {p}
              </button>
            ))}
          </div>
          <button type="button" onClick={trocarAcesso} className="w-full mt-4 text-sm text-white/60 underline">Voltar</button>
        </div>
      </div>
    );
  }

  if (modo === "adm" && config.pin && !admin) {
    const inputDark = { background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" };
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#072A33" }}>
        <div className="w-full max-w-xs">
          {!recuperar ? (
            <>
              <div className="text-center mb-7">
                <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-3" style={{ background: "rgba(255,255,255,0.12)" }}><Lock size={28} className="text-white" /></div>
                <h2 className="text-white font-bold text-xl">Área financeira</h2>
                <p className="text-white/60 text-sm mt-1">Digite o PIN para entrar</p>
              </div>
              <div className="flex justify-center gap-3 mb-2">
                {[0, 1, 2, 3].map((i) => (<div key={i} className="w-3.5 h-3.5 rounded-full transition-colors" style={{ background: pinDigitado.length > i ? "#fff" : "rgba(255,255,255,0.25)" }} />))}
              </div>
              <p className="text-center text-sm mb-3 h-5" style={{ color: "#FCA5A5" }}>{pinErro ? "PIN incorreto, tente de novo" : ""}</p>
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <button key={n} type="button" onClick={() => digitarPin(String(n))} className="py-4 rounded-2xl text-white text-xl font-semibold active:scale-95 transition-transform" style={{ background: "rgba(255,255,255,0.1)" }}>{n}</button>
                ))}
                <button type="button" onClick={abrirRecuperar} className="py-4 rounded-2xl text-white/55 text-xs font-medium" style={{ background: "rgba(255,255,255,0.05)" }}>Esqueci</button>
                <button type="button" onClick={() => digitarPin("0")} className="py-4 rounded-2xl text-white text-xl font-semibold active:scale-95 transition-transform" style={{ background: "rgba(255,255,255,0.1)" }}>0</button>
                <button type="button" onClick={apagarPin} className="py-4 rounded-2xl text-white flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)" }}><Delete size={20} /></button>
              </div>
              <button type="button" onClick={trocarAcesso} className="w-full mt-5 text-sm text-white/55 underline">Trocar acesso</button>
            </>
          ) : pinRevelado ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-3" style={{ background: "rgba(45,212,191,0.18)" }}><ShieldCheck size={28} style={{ color: C.aqua }} /></div>
              <h2 className="text-white font-bold text-xl">PIN liberado</h2>
              <p className="text-white/60 text-sm mt-1">Seu PIN é</p>
              <div className="text-3xl font-bold text-white my-3" style={{ letterSpacing: "0.3em" }}>{pinRevelado}</div>
              <button type="button" onClick={entrarRecuperacao} className="w-full py-3.5 rounded-2xl font-semibold text-white" style={{ background: `linear-gradient(135deg, ${C.water}, ${C.aqua})` }}>Entrar</button>
            </div>
          ) : (
            <div>
              <div className="text-center mb-5">
                <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-3" style={{ background: "rgba(255,255,255,0.12)" }}><Lock size={26} className="text-white" /></div>
                <h2 className="text-white font-bold text-xl">Recuperar acesso</h2>
              </div>
              {config.resposta ? (
                <>
                  <p className="text-white/80 text-sm mb-2">{config.pergunta || "Pergunta de segurança"}</p>
                  <input value={respInput} onChange={(e) => { setRespInput(e.target.value); setRespErro(false); }} placeholder="Sua resposta" className="w-full px-3 py-3 rounded-xl outline-none text-sm mb-1" style={inputDark} />
                  <p className="text-sm mb-2 h-5" style={{ color: "#FCA5A5" }}>{respErro ? "Resposta incorreta" : ""}</p>
                  <button type="button" onClick={confirmarResposta} className="w-full py-3.5 rounded-2xl font-semibold text-white" style={{ background: `linear-gradient(135deg, ${C.water}, ${C.aqua})` }}>Confirmar</button>
                </>
              ) : (
                <p className="text-white/70 text-sm text-center px-2">Nenhuma pergunta de segurança configurada.</p>
              )}
              <button type="button" onClick={fecharRecuperar} className="w-full mt-3 text-sm text-white/55 underline">Voltar pro PIN</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const totalProf = ehProf ? alunos.filter((a) => a.professor === profAtual).length : stats.total;

  return (
    <div className="min-h-screen pb-28" style={{ background: C.tint, color: C.ink }}>
      {/* Toasts */}
      {salvo && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded-xl text-sm font-medium text-white shadow-lg" style={{ background: C.paid }}>
          Salvo ✓
        </div>
      )}
      {msgFechado && (
        <div className="fixed top-4 left-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium text-white shadow-lg text-center" style={{ background: C.deep }}>
          {msgFechado}
        </div>
      )}

      {/* Cabeçalho */}
      <div className="px-5 pt-6 pb-8 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${C.deep} 0%, ${C.water} 70%, ${C.aqua} 130%)` }}>
        <div className="flex items-center gap-2 text-white/90">
          <Waves size={20} />
          <span className="text-sm font-medium uppercase" style={{ letterSpacing: "0.08em" }}>{ehProf ? "Cadastro de Alunos" : "Natação e Hidroginástica"}</span>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-white text-2xl font-bold mt-1">Alunos AMOC</h1>
            {ehProf ? (
              <button type="button" onClick={trocarAcesso} className="flex items-center gap-1.5 text-white/90 text-sm mt-1">
                <UserCog size={14} /> Prof. {profAtual} <ChevronDown size={14} />
              </button>
            ) : (
              <button type="button" onClick={abrirEditarMes} className="flex items-center gap-1.5 text-white/90 text-sm mt-1">
                <CalendarDays size={14} /> <span className="capitalize">{labelMes(ref)}</span> <ChevronDown size={14} />
              </button>
            )}
            <div className="flex items-center gap-1.5 mt-1 text-white/70 text-xs">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.aqua }} /> Sincroniza em tempo real
            </div>
          </div>
          <div className="flex items-center gap-2">
              <button type="button" onClick={trocarAcesso} className="p-2 rounded-xl text-white" style={{ background: "rgba(255,255,255,0.18)" }} title="Sair"><LogOut size={16} /></button>
              {!ehProf && <>
                <button type="button" onClick={onCadeado} className="p-2 rounded-xl text-white" style={{ background: "rgba(255,255,255,0.18)" }}><ShieldCheck size={16} /></button>
                <button type="button" onClick={abrirConfig} className="p-2 rounded-xl text-white" style={{ background: "rgba(255,255,255,0.18)" }}><Settings size={16} /></button>
                <button type="button" onClick={() => setVerHistorico(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "rgba(255,255,255,0.18)" }}><History size={15} /> Financeiro</button>
              </>}
            </div>
        </div>
        {ehProf ? (
          <div className="mt-5 rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: "rgba(255,255,255,0.16)" }}>
            <Users size={20} className="text-white shrink-0" />
            <div className="text-white">
              <div className="font-bold text-lg leading-tight">{totalProf}</div>
              <div className="text-white/80 text-xs">{totalProf === 1 ? "aluno seu" : "alunos seus"}</div>
            </div>
            <div className="ml-auto text-white/70 text-xs text-right leading-snug">cai direto na<br />lista da AMOC</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 mt-5">
            <Stat icon={<Users size={15} />} label="Alunos" value={stats.total} />
            <Stat icon={<Wallet size={15} />} label="Previsto" value={brl(stats.prevista)} />
            <Stat icon={<Check size={15} />} label="Recebido" value={brl(stats.recebido)} tone={C.paid} />
            <Stat icon={<AlertCircle size={15} />} label={`Pendente (${stats.qtdPendente})`} value={brl(stats.pendente)} tone={C.due} />
          </div>
        )}
      </div>

      {/* Busca + filtros */}
      <div className={ehProf ? "px-5 mt-4" : "px-5 -mt-4"}>
        <div className="rounded-2xl shadow-sm flex items-center px-3 py-2.5 gap-2" style={{ background: C.card, border: `1px solid ${C.line}` }}>
          <Search size={18} style={{ color: C.sub }} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar aluno..."
            className="flex-1 outline-none text-sm bg-transparent" style={{ color: C.ink }} />
          {busca && <X size={16} style={{ color: C.sub }} onClick={() => setBusca("")} className="cursor-pointer" />}
        </div>

        {ehProf && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            {["todos", ...PROFESSORES].map((p) => (
              <button key={p} onClick={() => setFiltroProf(p)}
                className="px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors"
                style={filtroProf === p ? { background: C.deep, color: "#fff" } : { background: C.card, color: C.sub, border: `1px solid ${C.line}` }}>
                {p === "todos" ? "Todos profs" : p}
              </button>
            ))}
          </div>
        )}

        {!ehProf && (
          <>
            <div className="flex gap-2 mt-3">
              {[{ k: "todos", t: "Todos" }, { k: "pendente", t: "Pendentes" }, { k: "pago", t: "Pagos" }].map((f) => (
                <button key={f.k} onClick={() => setFiltro(f.k)} className="px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors"
                  style={filtro === f.k ? { background: C.deep, color: "#fff" } : { background: C.card, color: C.sub, border: `1px solid ${C.line}` }}>{f.t}</button>
              ))}
              <button onClick={() => { if (exigeAdmin()) setConfirmReset(true); }} className="ml-auto px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1" style={{ background: C.card, color: C.due, border: `1px solid ${C.line}` }}>
                <RotateCcw size={13} /> Fechar mês
              </button>
            </div>
            <div className="flex gap-2 mt-2.5 overflow-x-auto pb-1">
              {["todos", ...PROFESSORES].map((p) => {
                const info = porProfessor.find((x) => x.nome === p);
                return (
                  <button key={p} onClick={() => setFiltroProf(p)} className="px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors"
                    style={filtroProf === p ? { background: C.water, color: "#fff" } : { background: C.card, color: C.sub, border: `1px solid ${C.line}` }}>
                    {p === "todos" ? "Todos profs" : p}
                    {info && info.pendentes > 0 && (<span className="text-xs px-1.5 rounded-full font-bold" style={filtroProf === p ? { background: "rgba(255,255,255,0.3)" } : { background: "#FCE9D2", color: C.due }}>{info.pendentes}</span>)}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 mt-2.5 overflow-x-auto pb-1">
              {["todos", ...NIVEIS].map((n) => (
                <button key={n} onClick={() => setFiltroNivel(n)}
                  className="px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors"
                  style={filtroNivel === n ? { background: C.aqua, color: "#fff" } : { background: C.card, color: C.sub, border: `1px solid ${C.line}` }}>
                  {n === "todos" ? "Todos níveis" : n}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {!ehProf && vencidos > 0 && filtro !== "pendente" && (
        <div className="px-5 mt-4">
          <button onClick={() => setFiltro("pendente")} className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-sm font-medium" style={{ background: "#FCEBEA", color: "#C0392B", border: "1px solid #F5C6C2" }}>
            <AlertCircle size={16} className="shrink-0" />
            <span className="flex-1 text-left">{vencidos} {vencidos === 1 ? "aluno com mensalidade vencida" : "alunos com mensalidade vencida"}</span>
            <span className="font-semibold">Ver</span>
          </button>
        </div>
      )}

      {/* Lista */}
      <div className="px-5 mt-4 space-y-2.5">
        {lista.length === 0 ? (
          <div className="text-center py-16" style={{ color: C.sub }}>
            <Waves size={36} className="mx-auto mb-3 opacity-40" />
            <p className="font-medium">{alunos.length === 0 ? "Nenhum aluno ainda" : "Nada encontrado"}</p>
            <p className="text-sm mt-1">{alunos.length === 0 ? "Toque em + para adicionar o primeiro" : "Tente outra busca"}</p>
          </div>
        ) : lista.map((a) => (
          <div key={a.id} className="rounded-2xl shadow-sm overflow-hidden" style={{ background: C.card, border: `1px solid ${C.line}` }}>
            <div className="flex">
              <div style={{ width: 5, background: ehProf ? C.water : (a.pago ? C.paid : C.due) }} />
              <div className="flex-1 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{a.nome}</h3>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="inline-block text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: C.tint, color: C.deep }}>{a.nivel}</span>
                      {!ehProf && a.professor && (<span className="inline-block text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#E8F0FE", color: C.water }}>Prof. {a.professor}</span>)}
                    </div>
                  </div>
                  {!ehProf && (
                    <div className="text-right shrink-0">
                      {quickEdit?.id === a.id && quickEdit?.field === "mensalidade" ? (
                        <input autoFocus value={quickEdit.value}
                          onChange={(e) => setQuickEdit({ ...quickEdit, value: e.target.value })}
                          onBlur={salvarQuickEdit}
                          onKeyDown={(e) => { if (e.key === "Enter") salvarQuickEdit(); if (e.key === "Escape") setQuickEdit(null); }}
                          className="w-24 text-right px-2 py-1 rounded-lg text-sm font-bold outline-none"
                          style={{ background: C.tint, border: `1px solid ${C.water}`, color: C.ink }}
                          inputMode="decimal" placeholder="0" />
                      ) : (
                        <button type="button"
                          onClick={() => { if (!exigeAdmin()) return; setQuickEdit({ id: a.id, field: "mensalidade", value: a.mensalidade || "" }); }}
                          className="font-bold" style={{ color: a.mensalidade ? C.ink : C.water }}>
                          {a.mensalidade ? brl(a.mensalidade) : "R$ —"}
                        </button>
                      )}
                      {a.vencimento ? (estaVencido(a) ? (
                        <div className="text-xs font-semibold flex items-center gap-1 justify-end" style={{ color: "#D14343" }}><AlertCircle size={12} /> venceu dia {a.vencimento}</div>
                      ) : (<div className="text-xs" style={{ color: C.sub }}>vence dia {a.vencimento}</div>)) : null}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-sm" style={{ color: C.sub }}>
                  {(a.dias || a.horario) && (<span className="flex items-center gap-1"><Clock size={13} /> {[a.dias, a.horario].filter(Boolean).join(" · ")}</span>)}
                  {quickEdit?.id === a.id && quickEdit?.field === "contato" ? (
                    <span className="flex items-center gap-1">
                      <MessageCircle size={13} style={{ color: C.water, flexShrink: 0 }} />
                      <input autoFocus value={quickEdit.value}
                        onChange={(e) => setQuickEdit({ ...quickEdit, value: formatTel(e.target.value) })}
                        onBlur={salvarQuickEdit}
                        onKeyDown={(e) => { if (e.key === "Enter") salvarQuickEdit(); if (e.key === "Escape") setQuickEdit(null); }}
                        className="outline-none text-sm w-36"
                        style={{ background: "transparent", borderBottom: `1px solid ${C.water}`, color: C.ink }}
                        inputMode="tel" placeholder="(69) 99999-9999" />
                    </span>
                  ) : a.contato ? (
                    <a href={linkZap(a, false)} target="_blank" rel="noreferrer" className="flex items-center gap-1"
                      onDoubleClick={(e) => { e.preventDefault(); setQuickEdit({ id: a.id, field: "contato", value: a.contato }); }}>
                      <MessageCircle size={13} /> {a.contato}
                    </a>
                  ) : (
                    <button type="button" onClick={() => setQuickEdit({ id: a.id, field: "contato", value: "" })}
                      className="flex items-center gap-1 text-xs" style={{ color: C.water }}>
                      <MessageCircle size={13} /> Adicionar contato
                    </button>
                  )}
                  {a.obs && <span className="w-full text-xs italic mt-0.5" style={{ color: C.sub }}>{a.obs}</span>}
                </div>
                <div className="flex gap-2 mt-3 pt-2.5" style={{ borderTop: `1px solid ${C.line}` }}>
                  {!ehProf && (
                    <button type="button" onClick={() => togglePago(a.id)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold flex-1 justify-center"
                      style={a.pago ? { background: "#E7F8ED", color: C.paid } : { background: `linear-gradient(135deg, ${C.deep}, ${C.water})`, color: "#fff" }}>
                      {a.pago ? <><Check size={14} /> Pago</> : "Marcar pago"}
                    </button>
                  )}
                  {!ehProf && a.contato && (
                    <a href={linkZap(a, true)} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium justify-center"
                      style={{ background: "#E7F8ED", color: C.paid }}>
                      <MessageCircle size={14} /> Cobrar
                    </a>
                  )}
                  {!ehProf && config.pixChave && (
                    <button type="button" onClick={() => copiarPix(a)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium"
                      style={copiadoId === a.id ? { background: "#E7F8ED", color: C.paid } : { background: C.tint, color: C.sub }}>
                      {copiadoId === a.id ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  )}
                  <button type="button" onClick={() => abrirEdicao(a)} className="p-2 rounded-xl" style={{ background: C.tint, color: C.sub }}><Pencil size={15} /></button>
                  {!ehProf && (
                    <button type="button" onClick={() => { if (exigeAdmin()) setExcluirId(a.id); }} className="p-2 rounded-xl" style={{ background: "#FCEBEA", color: "#D14343" }}><Trash2 size={15} /></button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={abrirNovo} className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform" style={{ background: `linear-gradient(135deg, ${C.water}, ${C.aqua})`, color: "#fff" }}>
        <Plus size={26} />
      </button>

      {/* Modal cadastro */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(10,42,51,0.45)" }} onClick={() => setModal(false)}>
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl flex flex-col" style={{ background: C.card, maxHeight: "85vh" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
              <h2 className="text-lg font-bold">{editId ? "Editar aluno" : "Novo aluno"}</h2>
              <button type="button" onClick={() => setModal(false)} className="p-1.5 rounded-lg" style={{ background: C.tint }}><X size={18} style={{ color: C.sub }} /></button>
            </div>
            <div ref={fieldsRef} className="space-y-3 px-5 overflow-y-auto flex-1">
              <Field label="Nome *">
                <Input inputRef={nomeRef} value={form.nome} onChange={(v) => { setForm({ ...form, nome: v }); if (v.trim()) setErroNome(false); }} placeholder="Nome do aluno" />
                {erroNome && <p className="text-xs mt-1" style={{ color: "#D14343" }}>Digite o nome do aluno para continuar</p>}
              </Field>
              <Field label="WhatsApp / Contato"><Input value={form.contato} onChange={(v) => setForm({ ...form, contato: formatTel(v) })} placeholder="(69) 99999-9999" inputMode="tel" /></Field>
              <Field label="Nível">
                <select value={form.nivel} onChange={(e) => setForm({ ...form, nivel: e.target.value })} className="w-full px-3 py-2.5 rounded-xl outline-none text-sm" style={{ background: C.tint, border: `1px solid ${C.line}`, color: C.ink }}>
                  {NIVEIS.map((n) => <option key={n}>{n}</option>)}
                </select>
              </Field>
              {!ehProf && (
                <Field label="Professor">
                  <select value={form.professor} onChange={(e) => setForm({ ...form, professor: e.target.value })} className="w-full px-3 py-2.5 rounded-xl outline-none text-sm" style={{ background: C.tint, border: `1px solid ${C.line}`, color: C.ink }}>
                    {PROFESSORES.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Dias da semana">
                <div className="flex flex-wrap gap-1.5">
                  {DIAS_SEMANA.map((d) => {
                    const sel = form.dias.split("/").includes(d);
                    return (<button key={d} type="button" onClick={() => toggleDia(d)} className="px-3 py-2 rounded-xl text-sm font-medium transition-colors" style={sel ? { background: C.deep, color: "#fff" } : { background: C.tint, color: C.sub, border: `1px solid ${C.line}` }}>{d}</button>);
                  })}
                </div>
              </Field>
              <Field label="Horário">
                <select value={form.horario} onChange={(e) => setForm({ ...form, horario: e.target.value })} className="w-full px-3 py-2.5 rounded-xl outline-none text-sm" style={{ background: C.tint, border: `1px solid ${C.line}`, color: C.ink }}>
                  <option value="">Escolher...</option>
                  {HORARIOS.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </Field>
              {!ehProf && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Mensalidade (R$)"><Input value={form.mensalidade} onChange={(v) => setForm({ ...form, mensalidade: v })} placeholder="150" inputMode="decimal" /></Field>
                  <Field label="Dia vencimento"><Input value={form.vencimento} onChange={(v) => setForm({ ...form, vencimento: v })} placeholder="10" inputMode="numeric" /></Field>
                </div>
              )}
              <Field label="Observações"><Input value={form.obs} onChange={(v) => setForm({ ...form, obs: v })} placeholder="Ex: medo de água fundo" /></Field>
              {ehProf && <p className="text-xs pb-1" style={{ color: C.sub }}>A mensalidade é definida pela administração depois.</p>}
            </div>
            <div className="px-5 py-4 shrink-0" style={{ borderTop: `1px solid ${C.line}` }}>
              <button type="button" onClick={salvar} className="w-full py-3.5 rounded-xl font-semibold text-white active:scale-[0.99] transition-transform" style={{ background: `linear-gradient(135deg, ${C.deep}, ${C.water})` }}>
                {editId ? "Salvar alterações" : "Adicionar aluno"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Configurações */}
      {verConfig && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(10,42,51,0.45)" }} onClick={() => setVerConfig(false)}>
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl flex flex-col" style={{ background: C.card, maxHeight: "88vh" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-2 shrink-0">
              <h3 className="font-bold text-base flex items-center gap-2"><Settings size={17} style={{ color: C.deep }} /> Configurações</h3>
              <button type="button" onClick={() => setVerConfig(false)} className="p-1.5 rounded-lg" style={{ background: C.tint }}><X size={18} style={{ color: C.sub }} /></button>
            </div>
            <div className="px-5 overflow-y-auto flex-1">
              <p className="text-xs mb-3 font-semibold uppercase" style={{ color: C.sub, letterSpacing: "0.05em" }}>Chave PIX</p>
              <label className="text-xs font-medium block mb-1" style={{ color: C.sub }}>Tipo da chave</label>
              <select value={tmpConfig.pixTipo} onChange={(e) => setTmpConfig({ ...tmpConfig, pixTipo: e.target.value })} className="w-full px-3 py-2.5 rounded-xl outline-none text-sm mb-3" style={{ background: C.tint, border: `1px solid ${C.line}`, color: C.ink }}>
                {["Telefone", "CPF", "E-mail", "Aleatória"].map((t) => <option key={t}>{t}</option>)}
              </select>
              <label className="text-xs font-medium block mb-1" style={{ color: C.sub }}>Chave PIX</label>
              <input value={tmpConfig.pixChave} onChange={(e) => setTmpConfig({ ...tmpConfig, pixChave: e.target.value })} placeholder="Sua chave" className="w-full px-3 py-2.5 rounded-xl outline-none text-sm mb-3" style={{ background: C.tint, border: `1px solid ${C.line}`, color: C.ink }} />
              <label className="text-xs font-medium block mb-1" style={{ color: C.sub }}>Nome do recebedor</label>
              <input value={tmpConfig.pixNome} onChange={(e) => setTmpConfig({ ...tmpConfig, pixNome: e.target.value })} placeholder="Ex: AMOC Natação" className="w-full px-3 py-2.5 rounded-xl outline-none text-sm mb-3" style={{ background: C.tint, border: `1px solid ${C.line}`, color: C.ink }} />
              <label className="text-xs font-medium block mb-1" style={{ color: C.sub }}>Cidade (opcional)</label>
              <input value={tmpConfig.pixCidade} onChange={(e) => setTmpConfig({ ...tmpConfig, pixCidade: e.target.value })} placeholder="Ex: Cacoal" className="w-full px-3 py-2.5 rounded-xl outline-none text-sm mb-4" style={{ background: C.tint, border: `1px solid ${C.line}`, color: C.ink }} />
              <button type="button" onClick={salvarConfig} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white mb-4" style={{ background: `linear-gradient(135deg, ${C.deep}, ${C.water})` }}>Salvar chave PIX</button>
              {config.pixChave && (
                <div className="rounded-2xl p-3 mb-4" style={{ background: C.tint, border: `1px solid ${C.line}` }}>
                  <div className="text-xs font-medium mb-1" style={{ color: C.sub }}>PIX copia e cola:</div>
                  <div className="text-xs break-all font-mono" style={{ color: C.ink }}>{pixCola()}</div>
                </div>
              )}
              <div className="pt-2 mb-4" style={{ borderTop: `1px solid ${C.line}` }}>
                <p className="text-xs mt-3 mb-2 font-semibold uppercase flex items-center gap-1.5" style={{ color: C.sub, letterSpacing: "0.05em" }}><ShieldCheck size={13} /> Segurança (ADM)</p>
                {config.pin ? (
                  <>
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-2" style={{ background: "#E6F6EF", color: C.paid }}><Lock size={15} /> <span className="text-sm font-medium">Proteção ativada</span></div>
                    <div className="flex gap-2">
                      <button type="button" onClick={alterarSenha} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: C.tint, color: C.deep }}>Alterar senha</button>
                      <button type="button" onClick={removerSenha} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "#FCEBEA", color: "#D14343" }}>Remover</button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs mb-2" style={{ color: C.sub }}>Crie uma senha de 4 dígitos para proteger o financeiro.</p>
                    <button type="button" onClick={alterarSenha} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-1.5" style={{ background: `linear-gradient(135deg, ${C.deep}, ${C.water})` }}><Lock size={15} /> Criar senha ADM</button>
                  </>
                )}
                <div className="mt-4 pt-3" style={{ borderTop: `1px dashed ${C.line}` }}>
                  <p className="text-xs font-medium mb-2" style={{ color: C.sub }}>Recuperação de PIN</p>
                  <label className="text-xs block mb-1" style={{ color: C.sub }}>Pergunta secreta</label>
                  <input value={tmpConfig.pergunta || ""} onChange={(e) => setTmpConfig({ ...tmpConfig, pergunta: e.target.value })} placeholder="Ex: Nome do meu primeiro cachorro?" className="w-full px-3 py-2.5 rounded-xl outline-none text-sm mb-2" style={{ background: C.tint, border: `1px solid ${C.line}`, color: C.ink }} />
                  <label className="text-xs block mb-1" style={{ color: C.sub }}>Resposta</label>
                  <input value={tmpConfig.resposta || ""} onChange={(e) => setTmpConfig({ ...tmpConfig, resposta: e.target.value })} placeholder="Sua resposta" className="w-full px-3 py-2.5 rounded-xl outline-none text-sm mb-2" style={{ background: C.tint, border: `1px solid ${C.line}`, color: C.ink }} />
                  <button type="button" onClick={salvarPergunta} className="w-full py-2.5 rounded-xl text-sm font-semibold" style={{ background: C.tint, color: C.deep }}>Salvar pergunta</button>
                  {config.resposta && <p className="text-xs mt-2 flex items-center gap-1" style={{ color: C.paid }}><Check size={12} /> Pergunta de recuperação ativa</p>}
                </div>
                <button type="button" onClick={trocarAcesso} className="w-full mt-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: C.tint, color: C.sub }}>Trocar tipo de acesso</button>
              </div>
            </div>
            {config.pixChave && (
              <div className="px-5 py-3 shrink-0 space-y-2" style={{ borderTop: `1px solid ${C.line}` }}>
                <a href={zapShare(pixCola())} target="_blank" rel="noreferrer" className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5" style={{ background: "#1FA855", color: "#fff" }}><MessageCircle size={15} /> Enviar PIX copia e cola</a>
                <a href={zapShare(config.pixChave)} target="_blank" rel="noreferrer" className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5" style={{ background: C.tint, color: C.deep }}>Enviar só a chave</a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Definir mês */}
      {editarMes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(10,42,51,0.45)" }} onClick={() => setEditarMes(false)}>
          <div className="w-full max-w-xs rounded-2xl p-5" style={{ background: C.card }} onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-base mb-3">Definir mês e ano</h3>
            <label className="text-xs font-medium block mb-1" style={{ color: C.sub }}>Mês</label>
            <select value={tmpRef.mes} onChange={(e) => setTmpRef({ ...tmpRef, mes: parseInt(e.target.value) })} className="w-full px-3 py-2.5 rounded-xl outline-none text-sm mb-3" style={{ background: C.tint, border: `1px solid ${C.line}`, color: C.ink }}>
              {MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <label className="text-xs font-medium block mb-1" style={{ color: C.sub }}>Ano</label>
            <div className="flex items-center gap-2 mb-4">
              <button type="button" onClick={() => setTmpRef({ ...tmpRef, ano: tmpRef.ano - 1 })} className="w-11 h-11 rounded-xl text-xl font-bold shrink-0" style={{ background: C.tint, color: C.deep }}>−</button>
              <div className="flex-1 text-center text-lg font-bold py-2 rounded-xl" style={{ background: C.tint, color: C.ink }}>{tmpRef.ano}</div>
              <button type="button" onClick={() => setTmpRef({ ...tmpRef, ano: tmpRef.ano + 1 })} className="w-11 h-11 rounded-xl text-xl font-bold shrink-0" style={{ background: C.tint, color: C.deep }}>+</button>
            </div>
            <p className="text-xs mb-3" style={{ color: C.sub }}>Isso só muda o mês mostrado. Os pagamentos <b>não</b> são zerados.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditarMes(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: C.tint, color: C.sub }}>Cancelar</button>
              <button type="button" onClick={definirMes} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: `linear-gradient(135deg, ${C.deep}, ${C.water})` }}>Definir</button>
            </div>
          </div>
        </div>
      )}

      {/* Fechar mês */}
      {confirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(10,42,51,0.45)" }} onClick={() => setConfirmReset(false)}>
          <div className="w-full max-w-xs rounded-2xl p-5" style={{ background: C.card }} onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-base">Fechar {labelMes(ref)}?</h3>
            <p className="text-sm mt-1.5" style={{ color: C.sub }}>O resumo será <b>salvo no histórico</b> e os pagamentos <b>zerados</b> para <b>{labelMes(proximoMes(ref))}</b>. Os cadastros continuam.</p>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setConfirmReset(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: C.tint, color: C.sub }}>Cancelar</button>
              <button onClick={fecharMes} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: C.due }}>Fechar mês</button>
            </div>
          </div>
        </div>
      )}

      {/* Excluir */}
      {excluirId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(10,42,51,0.45)" }} onClick={() => setExcluirId(null)}>
          <div className="w-full max-w-xs rounded-2xl p-5" style={{ background: C.card }} onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-base">Excluir aluno?</h3>
            <p className="text-sm mt-1.5" style={{ color: C.sub }}>{(() => { const al = alunos.find((a) => a.id === excluirId); return al ? <>Você vai remover <b>{al.nome}</b>. Isso não pode ser desfeito.</> : "Remover este aluno?"; })()}</p>
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setExcluirId(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: C.tint, color: C.sub }}>Cancelar</button>
              <button type="button" onClick={confirmarExcluir} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: "#D14343" }}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Controle financeiro */}
      {verHistorico && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(10,42,51,0.45)" }} onClick={() => setVerHistorico(false)}>
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl flex flex-col" style={{ background: C.card, maxHeight: "85vh" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
              <h2 className="text-lg font-bold flex items-center gap-2"><History size={18} style={{ color: C.deep }} /> Controle financeiro</h2>
              <button type="button" onClick={() => setVerHistorico(false)} className="p-1.5 rounded-lg" style={{ background: C.tint }}><X size={18} style={{ color: C.sub }} /></button>
            </div>
            <div className="px-5 pb-5 overflow-y-auto flex-1 space-y-4">
              <div className="rounded-2xl p-4" style={{ background: `linear-gradient(135deg, ${C.deep}, ${C.water})` }}>
                <div className="text-white/80 text-xs uppercase font-medium" style={{ letterSpacing: "0.06em" }}>Mês atual (em aberto)</div>
                <div className="text-white font-bold text-lg capitalize">{labelMes(ref)}</div>
                <div className="flex gap-4 mt-2 text-white">
                  <div><div className="text-white/70 text-xs">Recebido</div><div className="font-bold">{brl(stats.recebido)}</div></div>
                  <div><div className="text-white/70 text-xs">Previsto</div><div className="font-bold">{brl(stats.prevista)}</div></div>
                  <div><div className="text-white/70 text-xs">Pendente</div><div className="font-bold">{brl(stats.pendente)}</div></div>
                </div>
              </div>
              {anos.map((ano) => {
                const d = dadosAno(ano);
                const maxRec = Math.max(1, ...d.meses.map((m) => m.recebido || 0));
                return (
                  <div key={ano}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-base" style={{ color: C.deep }}>{ano}</h3>
                      <div className="text-right"><div className="text-xs" style={{ color: C.sub }}>Recebido no ano</div><div className="font-bold" style={{ color: C.paid }}>{brl(d.recebido)}</div></div>
                    </div>
                    {d.meses.length === 0 ? (
                      <p className="text-sm py-3 text-center rounded-xl" style={{ color: C.sub, background: C.tint }}>Nenhum mês fechado em {ano} ainda</p>
                    ) : (
                      <div className="space-y-1.5">
                        {d.meses.map((m) => (
                          <button key={m.id} type="button" onClick={() => setMesDetalhe(m)} className="w-full text-left rounded-xl p-3" style={{ background: C.tint, border: `1px solid ${C.line}` }}>
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm flex items-center gap-1">{MESES[m.mesNum]} <ChevronDown size={13} style={{ transform: "rotate(-90deg)", color: C.sub }} /></span>
                              <span className="font-bold text-sm" style={{ color: C.paid }}>{brl(m.recebido)}</span>
                            </div>
                            <div className="h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ background: "#fff" }}><div className="h-full rounded-full" style={{ width: `${Math.round((m.recebido / maxRec) * 100)}%`, background: C.water }} /></div>
                            <div className="flex gap-3 mt-1.5 text-xs" style={{ color: C.sub }}>
                              <span>{m.qtdPagos}/{m.totalAlunos} pagaram</span><span>Previsto: {brl(m.previsto)}</span>
                              {m.pendente > 0 && <span style={{ color: C.due }}>Faltou: {brl(m.pendente)}</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <p className="text-xs text-center pt-1" style={{ color: C.sub }}>Os meses entram aqui quando você toca em "Fechar mês".</p>
            </div>
          </div>
        </div>
      )}

      {/* Detalhe do mês */}
      {mesDetalhe && (
        <div className="fixed inset-0 flex items-end sm:items-center justify-center" style={{ background: "rgba(10,42,51,0.45)", zIndex: 60 }} onClick={() => setMesDetalhe(null)}>
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl flex flex-col" style={{ background: C.card, maxHeight: "88vh" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
              <div><h2 className="text-lg font-bold capitalize">{mesDetalhe.mes}</h2><span className="text-sm" style={{ color: C.sub }}>Prestação de contas</span></div>
              <button type="button" onClick={() => setMesDetalhe(null)} className="p-1.5 rounded-lg" style={{ background: C.tint }}><X size={18} style={{ color: C.sub }} /></button>
            </div>
            <div className="px-5 shrink-0">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl p-2.5 text-center" style={{ background: "#E6F6EF" }}><div className="text-xs" style={{ color: C.sub }}>Recebido</div><div className="font-bold text-sm" style={{ color: C.paid }}>{brl(mesDetalhe.recebido)}</div></div>
                <div className="rounded-xl p-2.5 text-center" style={{ background: C.tint }}><div className="text-xs" style={{ color: C.sub }}>Previsto</div><div className="font-bold text-sm" style={{ color: C.ink }}>{brl(mesDetalhe.previsto)}</div></div>
                <div className="rounded-xl p-2.5 text-center" style={{ background: "#FCE9D2" }}><div className="text-xs" style={{ color: C.sub }}>Faltou</div><div className="font-bold text-sm" style={{ color: C.due }}>{brl(mesDetalhe.pendente)}</div></div>
              </div>
            </div>
            <div className="px-5 py-3 overflow-y-auto flex-1">
              {!mesDetalhe.alunosSnap ? (
                <p className="text-sm text-center py-8" style={{ color: C.sub }}>Mês fechado antes desta atualização — só o resumo disponível.</p>
              ) : (
                <div className="space-y-1.5">
                  {[...mesDetalhe.alunosSnap].sort((a, b) => Number(a.pago) - Number(b.pago) || a.nome.localeCompare(b.nome)).map((a, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: C.tint }}>
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: a.pago ? C.paid : C.due }} />
                      <div className="min-w-0 flex-1"><div className="font-medium text-sm truncate">{a.nome}</div>{a.professor && <div className="text-xs" style={{ color: C.sub }}>{a.professor}</div>}</div>
                      <div className="text-right shrink-0"><div className="font-semibold text-sm">{brl(a.mensalidade)}</div><div className="text-xs font-medium" style={{ color: a.pago ? C.paid : C.due }}>{a.pago ? "Pago" : "Não pagou"}</div></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-5 py-4 shrink-0" style={{ borderTop: `1px solid ${C.line}` }}>
              <a href={zapShare(textoPrestacao(mesDetalhe))} target="_blank" rel="noreferrer" className="w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-1.5" style={{ background: "#1FA855" }}><MessageCircle size={16} /> Compartilhar no WhatsApp</a>
            </div>
          </div>
        </div>
      )}

      {/* PIN */}
      {verPin && (
        <div className="fixed inset-0 flex items-center justify-center p-6" style={{ background: "rgba(7,42,51,0.97)", zIndex: 70 }} onClick={cancelarPin}>
          <div className="w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-3" style={{ background: "rgba(255,255,255,0.12)" }}><Lock size={24} className="text-white" /></div>
              <h2 className="text-white font-bold text-xl">{modoPin === "definir" ? "Criar senha ADM" : "Digite o PIN"}</h2>
              {modoPin === "definir" && <p className="text-white/60 text-sm mt-1">Escolha 4 dígitos</p>}
            </div>
            <div className="flex justify-center gap-3 mb-2">
              {[0, 1, 2, 3].map((i) => (<div key={i} className="w-3.5 h-3.5 rounded-full transition-colors" style={{ background: pinDigitado.length > i ? "#fff" : "rgba(255,255,255,0.25)" }} />))}
            </div>
            <p className="text-center text-sm mb-4 h-5" style={{ color: "#FCA5A5" }}>{pinErro ? "PIN incorreto" : ""}</p>
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button key={n} type="button" onClick={() => digitarPin(String(n))} className="py-4 rounded-2xl text-white text-xl font-semibold active:scale-95 transition-transform" style={{ background: "rgba(255,255,255,0.1)" }}>{n}</button>
              ))}
              <div />
              <button type="button" onClick={() => digitarPin("0")} className="py-4 rounded-2xl text-white text-xl font-semibold active:scale-95 transition-transform" style={{ background: "rgba(255,255,255,0.1)" }}>0</button>
              <button type="button" onClick={apagarPin} className="py-4 rounded-2xl text-white flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)" }}><Delete size={20} /></button>
            </div>
            <button type="button" onClick={cancelarPin} className="w-full mt-5 text-sm text-white/55 underline">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
