import {
  CircleCheck, CloudOff, CloudUpload, Database, Download, Eye, EyeOff, FileSpreadsheet, Info, KeyRound, LoaderCircle, Lock,
  LogOut, RotateCcw, ShieldCheck, Smartphone, Sparkles, User,
} from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent, type FormEvent, type ReactNode } from 'react';
import { adminLogin, clearFailures, endSession, getSession, lockRemaining, registerFailure, type AdminSession } from '../lib/admin-auth';
import { prettyName } from '../lib/catalog';
import {
  cleanProductName, detectHeader, renderReportMarkdown, reportSummaryRows, summarizeGroups, updateCatalog,
  type CatalogFile, type ImportReport,
} from '../lib/erp/erp-catalog.js';
import { formatLabel, readSpreadsheet, SPREADSHEET_ACCEPT, SPREADSHEET_EXTENSIONS, type SpreadsheetFormat } from '../lib/erp/sheet-reader.js';
import { brl, formatDateTime, intBR } from '../lib/format';
import { buildProduct3DPrompt } from '../lib/image3d';
import { publishCatalog, SessionExpiredError } from '../lib/publish';
import { useCatalog, useUI, type CatalogOrigin } from '../state/store';
import { CloseButton, Modal } from './ui/Overlay';

interface ImportResult {
  file: CatalogFile;
  report: ImportReport;
  fileName: string;
  format: SpreadsheetFormat;
  preview: { raw: string; pretty: string }[];
  groups: { group: string; count: number }[];
}

const ORIGIN_LABEL: Record<CatalogOrigin, { text: string; cls: string }> = {
  site: { text: 'CATÁLOGO DO SITE', cls: 'bg-slate-200 text-slate-700' },
  publicado: { text: 'PUBLICADO ON-LINE', cls: 'bg-emerald-100 text-emerald-800' },
  aparelho: { text: 'APLICADO SÓ NESTE APARELHO', cls: 'bg-secondary-100 text-secondary-800' },
};

const inputCls =
  'h-14 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-lg text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-100';

function Details({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <details className="group overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 open:shadow-sm">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-base font-bold text-slate-800 hover:bg-slate-50">
        <span>{title}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-sm ${count ? 'bg-secondary-100 text-secondary-800' : 'bg-slate-100 text-slate-500'}`}>{intBR(count)}</span>
      </summary>
      <div className="max-h-72 overflow-y-auto border-t border-slate-100 px-4 py-3 text-sm">{count ? children : <p className="text-slate-500">Nenhum.</p>}</div>
    </details>
  );
}

const download = (content: string, name: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
};

/** Tela de login do administrador. */
function LoginForm({ onSuccess, notice }: { onSuccess: (s: AdminSession) => void; notice?: string }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lock, setLock] = useState(() => lockRemaining());

  useEffect(() => {
    if (lock <= 0) return;
    const t = setInterval(() => setLock(lockRemaining()), 1000);
    return () => clearInterval(t);
  }, [lock]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || lockRemaining() > 0) return;
    if (!login.trim() || !password) {
      setError('Preencha o login e a senha.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const session = await adminLogin(login, password);
      if (session) {
        clearFailures();
        onSuccess(session);
      } else {
        registerFailure();
        setLock(lockRemaining());
        setPassword('');
        setError('Login ou senha incorretos.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível verificar agora. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-md space-y-5 px-5 py-8 sm:px-7" noValidate>
      <div className="text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-secondary-600 to-secondary-800 text-white shadow-lg">
          <KeyRound className="h-8 w-8" />
        </span>
        <p className="mt-4 text-lg font-extrabold text-slate-900">Acesso restrito à equipe da farmácia</p>
        <p className="mt-1 text-base text-slate-600">Entre com o login de administrador para enviar a planilha de produtos.</p>
      </div>

      {notice && <p className="rounded-2xl bg-primary-50 p-3 text-base font-semibold text-primary-900 ring-1 ring-primary-200">{notice}</p>}

      <div>
        <label htmlFor="adm-login" className="mb-1.5 block text-base font-bold text-slate-800">
          Login
        </label>
        <div className="relative">
          <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            id="adm-login"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={`${inputCls} pl-12`}
          />
        </div>
      </div>

      <div>
        <label htmlFor="adm-pass" className="mb-1.5 block text-base font-bold text-slate-800">
          Senha
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            id="adm-pass"
            type={show ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className={`${inputCls} pl-12 pr-14`}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
            className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"
          >
            {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {lock > 0 ? (
        <p className="rounded-2xl bg-primary-50 p-3 text-base font-semibold text-primary-900 ring-1 ring-primary-200" role="alert">
          Muitas tentativas erradas. Aguarde {lock}s para tentar de novo.
        </p>
      ) : (
        error && (
          <p className="rounded-2xl bg-rose-50 p-3 text-base font-semibold text-rose-800 ring-1 ring-rose-200" role="alert">
            {error}
          </p>
        )
      )}

      <button
        type="submit"
        disabled={busy || lock > 0}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-700 px-5 text-lg font-bold text-white shadow-lg shadow-primary-600/30 transition hover:brightness-105 disabled:opacity-60"
      >
        {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
        {busy ? 'Verificando...' : 'Entrar'}
      </button>
    </form>
  );
}

/** Área do administrador: login + envio da planilha + publicação no site. */
export function AdminImport() {
  const ui = useUI();
  const catalog = useCatalog();
  const [session, setSession] = useState<AdminSession | null>(() => getSession());
  const [loginNotice, setLoginNotice] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<'idle' | 'reading' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [includeOut, setIncludeOut] = useState(true);
  const [drag, setDrag] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [applied, setApplied] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [publishError, setPublishError] = useState('');

  const current = catalog.file;
  const online = catalog.online;

  useEffect(() => {
    if (ui.adminOpen) setSession(getSession());
  }, [ui.adminOpen]);

  const handleFile = async (f: File) => {
    if (!SPREADSHEET_EXTENSIONS.test(f.name)) {
      setStage('error');
      setError('Formato não suportado. Envie a planilha em .xlsx, .xls ou .csv.');
      return;
    }
    setStage('reading');
    setError('');
    setApplied(false);
    setPublished(false);
    setPublishError('');
    setProgress('Abrindo a planilha...');
    try {
      const buffer = await f.arrayBuffer();
      const { rows, format } = await readSpreadsheet(buffer, {
        fileName: f.name,
        onProgress: ({ stage: s, rows: n }) =>
          setProgress(s === 'rows' ? `Lendo produtos... ${intBR(n ?? 0)} linhas` : s === 'strings' ? 'Lendo nomes dos produtos...' : 'Abrindo a planilha...'),
      });
      setProgress('Conferindo códigos e comparando com o catálogo atual...');
      const { file, report } = updateCatalog(current, rows, { sourceName: f.name, includeOutOfStock: includeOut });
      const header = detectHeader(rows);
      const preview = header
        ? rows
            .slice(header.row + 1)
            .filter((r) => r && r[header.idx.name])
            .slice(0, 6)
            .map((r) => {
              const raw = String(r[header.idx.name]);
              return { raw, pretty: prettyName(cleanProductName(raw).name) };
            })
        : [];
      setResult({ file, report, fileName: f.name, format, preview, groups: summarizeGroups(file).slice(0, 14) });
      setStage('done');
    } catch (e) {
      setStage('error');
      setError(e instanceof Error ? e.message : 'Não foi possível ler a planilha.');
    }
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  };

  const expireSession = () => {
    endSession();
    setSession(null);
    setLoginNotice('Sua sessão expirou. Entre de novo para publicar: a planilha já lida continua aqui.');
  };

  const publish = async () => {
    if (!result || !session) return;
    if (!session.token || session.exp <= Date.now()) {
      expireSession();
      return;
    }
    setPublishing(true);
    setPublishError('');
    try {
      await publishCatalog(result.file, { token: session.token, expiresAt: session.exp });
      catalog.markPublished(result.file);
      setPublished(true);
      ui.toast(`Site atualizado: ${intBR(result.file.stats.exported)} produtos para todos os clientes`, { tone: 'success' });
    } catch (e) {
      if (e instanceof SessionExpiredError) expireSession();
      else setPublishError(e instanceof Error ? e.message : 'Não foi possível publicar agora.');
    } finally {
      setPublishing(false);
    }
  };

  const applyHere = async () => {
    if (!result) return;
    await catalog.applyCatalog(result.file);
    setApplied(true);
    ui.toast(`Aplicado neste aparelho: ${intBR(result.file.stats.exported)} produtos`, { tone: 'success' });
  };

  const logout = () => {
    endSession();
    setSession(null);
    setLoginNotice('');
    setResult(null);
    setStage('idle');
  };

  const close = () => {
    ui.setAdminOpen(false);
    if (/^#(admin|lojista)$/i.test(window.location.hash)) history.replaceState(null, '', window.location.pathname + window.location.search);
  };

  const r = result?.report;
  const tiles = r
    ? reportSummaryRows(r).filter(([label]) =>
        ['Produtos analisados', 'Produtos atualizados', 'Preços alterados', 'Produtos novos', 'Mantidos', 'Não identificados', 'Com informações', 'Erros'].some((k) => label.startsWith(k)),
      )
    : [];
  const missingByField: Record<string, number> = {};
  if (r) for (const i of r.incomplete) for (const f of i.missing) missingByField[f] = (missingByField[f] ?? 0) + 1;
  const originInfo = ORIGIN_LABEL[catalog.origin];
  const secondaryBtn =
    'flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-base font-bold text-secondary-700 ring-2 ring-secondary-200 hover:bg-secondary-50';

  return (
    <Modal open={ui.adminOpen} onClose={close} label="Área do administrador — envio da planilha de produtos" className="sm:max-w-3xl">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-7">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-secondary-600">
            <Lock className="h-4 w-4" /> Área do administrador
          </p>
          <h2 className="text-xl font-extrabold leading-tight text-slate-900 sm:text-2xl">
            {session ? 'Envie a planilha de manutenção de produtos' : 'Entrar para enviar a planilha'}
          </h2>
        </div>
        <CloseButton onClick={close} />
      </div>

      {!session ? (
        <LoginForm
          notice={loginNotice}
          onSuccess={(s) => {
            setLoginNotice('');
            setSession(s);
          }}
        />
      ) : (
        <div className="space-y-5 px-5 py-6 sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-emerald-50 px-4 py-2.5 text-base text-emerald-900 ring-1 ring-emerald-200">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> Conectado como <strong>{session.user}</strong>
            </span>
            <button type="button" onClick={logout} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold hover:bg-emerald-100">
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>

          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            className={`flex cursor-pointer flex-col items-center rounded-3xl border-2 border-dashed px-6 py-8 text-center transition ${
              drag ? 'border-primary-500 bg-primary-50' : 'border-slate-300 bg-white hover:border-secondary-400 hover:bg-secondary-50/40'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={SPREADSHEET_ACCEPT}
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = '';
              }}
            />
            {stage === 'reading' ? (
              <LoaderCircle className="h-12 w-12 animate-spin text-primary-600" />
            ) : (
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-secondary-600 to-secondary-800 text-white shadow-lg">
                <CloudUpload className="h-8 w-8" />
              </span>
            )}
            {stage === 'reading' ? (
              <p className="mt-4 text-lg font-extrabold text-slate-900">{progress}</p>
            ) : (
              <>
                <p className="mt-4 text-lg font-extrabold text-slate-900">Envie a planilha de manutenção de produtos</p>
                <p className="mt-1 max-w-md text-base text-slate-600">
                  Arraste o arquivo .xlsx, .xls ou .csv aqui. Lemos todas as linhas antes de alterar qualquer preço.
                </p>
                <span className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-primary-600 px-6 text-base font-bold text-white shadow-lg shadow-primary-600/30">
                  <FileSpreadsheet className="h-5 w-5" /> Selecionar planilha
                </span>
              </>
            )}
          </label>

          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
              <Database className="h-4 w-4" /> Catálogo em uso
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-base font-semibold text-slate-900">
              <span className="break-all">{current.source || 'Catálogo embutido'}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${originInfo.cls}`}>{originInfo.text}</span>
              {current.sample && <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-bold text-primary-800">AMOSTRA</span>}
            </p>
            <p className="text-sm text-slate-600">
              {intBR(current.stats.exported)} produtos na loja · {intBR(catalog.inStockCount)} com estoque · gerado em {formatDateTime(current.generatedAt)}
            </p>
            {catalog.origin === 'aparelho' && (
              <button
                type="button"
                onClick={() => void catalog.resetCatalog()}
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-3 text-sm font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
              >
                <RotateCcw className="h-4 w-4" /> Voltar ao catálogo do site
              </button>
            )}
          </div>

          <label className="flex min-h-12 cursor-pointer items-center gap-3 text-base text-slate-700">
            <input type="checkbox" checked={includeOut} onChange={(e) => setIncludeOut(e.target.checked)} className="h-6 w-6 accent-primary-600" />
            Cadastrar também produtos novos sem estoque (aparecem como “indisponível”, com botão Avise-me)
          </label>

          <p className="flex gap-2 rounded-2xl bg-secondary-50 p-4 text-sm text-secondary-900">
            <ShieldCheck className="h-5 w-5 shrink-0" />
            <span>
              Atualização segura: os produtos são associados pelo <strong>código</strong>, os existentes são atualizados, os novos são cadastrados e
              <strong> nenhum produto real é excluído</strong>. O preço exibido é sempre o <strong>Preço Venda</strong>. Custo, markup, valor ST,
              fornecedor e comissão são descartados.
            </span>
          </p>

          {stage === 'error' && <p className="rounded-2xl bg-rose-50 p-4 text-base font-semibold text-rose-800 ring-1 ring-rose-200">{error}</p>}

          {stage === 'done' && result && r && (
            <div className="space-y-5">
              <div className="flex items-start gap-2 text-lg font-extrabold text-emerald-700">
                <CircleCheck className="mt-0.5 h-6 w-6 shrink-0" />
                <span>
                  Planilha lida por completo: {result.fileName} <span className="font-semibold text-emerald-800">· {formatLabel(result.format)}</span>
                </span>
              </div>
              {r.missingColumns.length > 0 && (
                <p className="rounded-2xl bg-primary-50 p-3 text-sm font-semibold text-primary-900 ring-1 ring-primary-200">
                  Colunas não encontradas: {r.missingColumns.join(', ')}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {tiles.map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                    <p className="text-2xl font-extrabold text-secondary-800">{intBR(value)}</p>
                    <p className="text-sm font-medium leading-snug text-slate-600">{label}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Details title="Preços alterados" count={r.priceChanges.length}>
                  <ul className="space-y-1.5">
                    {r.priceChanges.slice(0, 200).map((p) => (
                      <li key={p.code} className="flex justify-between gap-3">
                        <span className="min-w-0 truncate text-slate-800">
                          <span className="text-slate-400">{p.code}</span> {prettyName(p.name)}
                        </span>
                        <span className="shrink-0 font-semibold">
                          <span className="text-slate-400 line-through">{brl(p.oldPrice)}</span> → <span className="text-primary-700">{brl(p.newPrice)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  {r.priceChanges.length > 200 && <p className="mt-2 text-slate-500">… lista completa no relatório.</p>}
                </Details>
                <Details title="Produtos novos cadastrados" count={r.added.length}>
                  <ul className="space-y-1">
                    {r.added.slice(0, 200).map((p) => (
                      <li key={p.code} className="flex justify-between gap-3">
                        <span className="min-w-0 truncate">
                          <span className="text-slate-400">{p.code}</span> {prettyName(p.name)}
                        </span>
                        <span className="shrink-0 font-semibold">{brl(p.price)}</span>
                      </li>
                    ))}
                  </ul>
                </Details>
                <Details title="Não puderam ser identificados" count={r.unidentified.length}>
                  <ul className="space-y-1.5">
                    {r.unidentified.map((e, i) => (
                      <li key={`${e.row}-${i}`}>
                        <strong>Linha {e.row}</strong> {e.code && `· ${e.code}`} {e.name && `· ${e.name}`} — {e.message}
                      </li>
                    ))}
                  </ul>
                </Details>
                <Details title="Códigos duplicados na planilha" count={r.duplicates.length}>
                  <ul className="space-y-1.5">
                    {r.duplicates.map((d) => (
                      <li key={d.code}>
                        <strong>{d.code}</strong> · {d.name} — linhas {d.rows.join(', ')}: {d.resolution}
                      </li>
                    ))}
                  </ul>
                </Details>
                <Details title="Informações incompletas (importados normalmente)" count={r.incomplete.length}>
                  <p>
                    {Object.entries(missingByField)
                      .map(([k, v]) => `${k}: ${intBR(v)}`)
                      .join(' · ')}
                  </p>
                </Details>
                <Details title="Erros durante a importação" count={r.errors.length}>
                  <ul className="space-y-1.5">
                    {r.errors.map((e, i) => (
                      <li key={`${e.row}-${i}`}>
                        <strong>Linha {e.row}</strong> {e.code && `· ${e.code}`} {e.name && `· ${e.name}`} — {e.message}
                      </li>
                    ))}
                  </ul>
                </Details>
                <Details title="Alertas" count={r.alerts.length}>
                  <ul className="space-y-1.5">
                    {r.alerts.slice(0, 200).map((e, i) => (
                      <li key={`${e.row}-${i}`}>
                        {e.row > 0 && (
                          <>
                            <strong>Linha {e.row}</strong> · {e.code} · {e.name} —{' '}
                          </>
                        )}
                        {e.message}
                      </li>
                    ))}
                  </ul>
                </Details>
                {r.demoRemoved.length > 0 && (
                  <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600 ring-1 ring-slate-200">
                    {intBR(r.demoRemoved.length)} itens ilustrativos do protótipo serão removidos (não pertencem à farmácia). Nenhum produto real é excluído.
                  </p>
                )}
              </div>

              {result.preview.length > 0 && (
                <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200">
                  <p className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-600">
                    <FileSpreadsheet className="h-4 w-4" /> Higienização dos nomes (amostra)
                  </p>
                  <ul className="divide-y divide-slate-100">
                    {result.preview.map((p) => (
                      <li key={p.raw} className="grid gap-1 px-4 py-2.5 text-sm sm:grid-cols-2 sm:gap-4">
                        <span className="min-w-0 font-mono text-xs text-slate-500 [overflow-wrap:anywhere]">{p.raw}</span>
                        <span className="min-w-0 font-semibold text-slate-900 [overflow-wrap:anywhere]">→ {p.pretty}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-2xl bg-gradient-to-br from-secondary-50 to-primary-50 p-4 ring-1 ring-secondary-100">
                <p className="flex items-center gap-2 text-base font-bold text-secondary-900">
                  <Sparkles className="h-5 w-5 text-primary-600" /> Artes dos produtos: {intBR(r.added.length)} novos na fila do pipeline 3D
                </p>
                <p className="mt-1 text-sm text-slate-700">As artes seguem o mesmo padrão visual da loja: só nome, preço e promoção mudam.</p>
                {r.added[0] && (
                  <p className="mt-2 min-w-0 rounded-xl bg-white/80 p-3 font-mono text-xs leading-relaxed text-slate-700 [overflow-wrap:anywhere]">
                    {buildProduct3DPrompt({ name: prettyName(r.added[0].name) })}
                  </p>
                )}
              </div>

              {online ? (
                <div className="space-y-3">
                  {publishError && (
                    <p className="rounded-2xl bg-rose-50 p-4 text-base font-semibold text-rose-800 ring-1 ring-rose-200" role="alert">
                      {publishError}
                    </p>
                  )}
                  <div className="grid gap-3 sm:grid-cols-[1.5fr_1fr]">
                    <button
                      type="button"
                      onClick={() => void publish()}
                      disabled={publishing || published}
                      className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-700 px-4 text-lg font-bold text-white shadow-lg shadow-primary-600/30 transition hover:brightness-105 disabled:cursor-default disabled:from-emerald-600 disabled:to-emerald-700 disabled:opacity-100"
                    >
                      {publishing ? <LoaderCircle className="h-5 w-5 animate-spin" /> : published ? <CircleCheck className="h-5 w-5" /> : <CloudUpload className="h-5 w-5" />}
                      {publishing ? 'Publicando...' : published ? 'Publicado no site' : 'Publicar no site para todos'}
                    </button>
                    <button
                      type="button"
                      onClick={() => download(renderReportMarkdown(r), `relatorio-atualizacao-${new Date().toISOString().slice(0, 10)}.md`, 'text/markdown')}
                      className={secondaryBtn}
                    >
                      <FileSpreadsheet className="h-5 w-5" /> Baixar relatório
                    </button>
                  </div>
                  {published && (
                    <p className="flex items-start gap-2 rounded-2xl bg-emerald-50 p-4 text-base text-emerald-900 ring-1 ring-emerald-200">
                      <CircleCheck className="mt-0.5 h-5 w-5 shrink-0" /> Pronto! Os clientes já recebem os produtos atualizados (em até 1 minuto).
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => download(JSON.stringify(result.file), 'catalog.json', 'application/json')}
                    className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-secondary-700"
                  >
                    <Download className="h-4 w-4" /> Baixar cópia de segurança (catalog.json)
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-2xl bg-primary-50 p-4 text-sm text-primary-950 ring-1 ring-primary-200">
                    <p className="flex items-center gap-2 text-base font-extrabold">
                      <CloudOff className="h-5 w-5 shrink-0" /> Publicação automática ainda não conectada
                    </p>
                    <p className="mt-1.5">
                      Para os clientes verem os produtos atualizados assim que você enviar a planilha, o site precisa ser ligado a um armazenamento on-line
                      gratuito (Supabase). É uma configuração única. Até lá, aplique neste aparelho para conferir e baixe o catalog.json para publicação.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => void applyHere()}
                      disabled={applied}
                      className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-700 px-4 text-base font-bold text-white shadow-lg shadow-primary-600/30 disabled:from-emerald-600 disabled:to-emerald-700"
                    >
                      {applied ? <CircleCheck className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
                      {applied ? 'Aplicado' : 'Aplicar neste aparelho'}
                    </button>
                    <button type="button" onClick={() => download(JSON.stringify(result.file), 'catalog.json', 'application/json')} className={secondaryBtn}>
                      <Download className="h-5 w-5" /> Baixar catalog.json
                    </button>
                    <button
                      type="button"
                      onClick={() => download(renderReportMarkdown(r), `relatorio-atualizacao-${new Date().toISOString().slice(0, 10)}.md`, 'text/markdown')}
                      className={secondaryBtn}
                    >
                      <FileSpreadsheet className="h-5 w-5" /> Baixar relatório
                    </button>
                  </div>
                  <p className="flex gap-2 text-sm text-slate-600">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>“Aplicar neste aparelho” mostra o novo catálogo só aqui, para conferência. Os clientes continuam vendo o catálogo do site.</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
