import { ArrowLeft, Camera, Check, ChevronRight, CreditCard, FileText, FolderOpen, ImagePlus, Images, LoaderCircle, LockKeyhole, Maximize2, Save, Syringe, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { useScrollLock } from '../hooks/common';
import { DOCUMENT_KEY, DOCUMENT_KINDS, documentFile, preparePhoto, readDocuments, removeDocument, saveDocument, type DocumentKind, type DocumentPhoto, type SavedDocument } from '../lib/health-documents';
import { DocumentPhotoHandoff } from './DocumentPhotoHandoff';

type View = 'choose' | 'saved' | 'preview' | 'enlarge';
const titles: Record<View, string> = { choose: 'Enviar receita ou cartão de vacina', saved: 'Meus Cartões Salvos', preview: 'Confira a foto', enlarge: 'Foto do documento' };
const dateLabel = (time: number) => new Date(time).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const errorMessage = (e: unknown, fallback: string) => e instanceof Error ? e.message : fallback;

function HealthDocumentDialog({ initialView, onClose }: { initialView: 'choose' | 'saved'; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const readVersion = useRef(0);
  const [view, setView] = useState<View>(initialView);
  const [photo, setPhoto] = useState<DocumentPhoto | null>(null);
  const [docs, setDocs] = useState<SavedDocument[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [draftKind, setDraftKind] = useState<DocumentKind>(initialView === 'saved' ? 'vaccine' : 'prescription');
  useScrollLock(true);

  useLayoutEffect(() => {
    const el = dialog.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    el?.showModal();
    return () => {
      readVersion.current++;
      el?.close();
      trigger?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    if (dialog.current) dialog.current.scrollTop = 0;
  }, [view]);

  useEffect(() => {
    const refresh = () => {
      try { setDocs(readDocuments()); }
      catch (e) { setError(errorMessage(e, 'Não foi possível abrir seus cartões.')); }
    };
    refresh();
    const sync = (e: StorageEvent) => { if (e.key === DOCUMENT_KEY || e.key === null) refresh(); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const switchTo = (next: View) => {
    setView(next); setError(''); setNotice(''); setDeleteId(null);
  };
  const selectFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    const version = ++readVersion.current;
    setBusy(true); setError(''); setNotice('');
    try {
      const next = await preparePhoto(file, draftKind);
      if (version !== readVersion.current) return;
      setPhoto(next); switchTo('preview');
    } catch (err) {
      if (version === readVersion.current) setError(errorMessage(err, 'Não foi possível abrir esta foto.'));
    } finally { if (version === readVersion.current) setBusy(false); }
  };

  const pickSaved = (doc: SavedDocument) => {
    try {
      setPhoto({ ...doc, file: documentFile(doc) }); switchTo('preview');
    } catch { setError('Esta foto não abriu. Escolha outra foto da galeria.'); }
  };
  const save = () => {
    if (!photo) return;
    try {
      setDocs(saveDocument(photo)); setError(''); setNotice('Foto guardada em Meus Cartões Salvos.');
    } catch (err) { setError(errorMessage(err, 'Não foi possível salvar a foto.')); }
  };
  const remove = (id: string) => {
    try {
      setDocs(removeDocument(id)); setDeleteId(null); setError(''); setNotice('Foto removida deste aparelho.');
      if (photo?.id === id) setPhoto(null);
    } catch (err) { setError(errorMessage(err, 'Não foi possível remover a foto.')); }
  };
  const kindChange = (kind: DocumentKind) => {
    if (!photo) return;
    const next = { ...photo, kind };
    setPhoto({ ...next, file: documentFile(next) }); setError(''); setNotice('');
  };
  const saved = photo && docs.some(d => d.id === photo.id && d.kind === photo.kind);
  const KindIcon = photo?.kind === 'vaccine' ? Syringe : photo?.kind === 'insurance' ? CreditCard : FileText;

  return createPortal(
    <dialog ref={dialog} className="health-dialog" aria-labelledby="document-dialog-title"
      onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === dialog.current) onClose(); }}>
      <div className="health-dialog-content">
        <header className="health-dialog-header">
          <span className="document-eyebrow"><Camera size={16} aria-hidden="true" /> Atendimento por foto</span>
          <button type="button" className="document-close" aria-label="Fechar documentos" onClick={onClose}><X aria-hidden="true" /></button>
          <h2 id="document-dialog-title" ref={heading} tabIndex={-1}>{titles[view]}</h2>
        </header>
        <input ref={camera} type="file" accept="image/*" capture="environment" aria-label="Fotografar com a câmera traseira" hidden onChange={selectFile} />
        <input ref={gallery} type="file" accept="image/*" aria-label="Selecionar uma foto da galeria" hidden onChange={selectFile} />

        {view === 'choose' && <>
          <p className="document-intro">Use a câmera ou escolha uma foto que já está no seu celular.</p>
          <div className="document-options">
            <button type="button" className="document-option" disabled={busy} onClick={() => camera.current?.click()}>
              <span className="option-symbol warm"><Camera aria-hidden="true" /></span>
              <span><strong>Tirar Foto Agora</strong><small>Usar a câmera traseira</small></span><ChevronRight className="option-arrow" aria-hidden="true" />
            </button>
            <button type="button" className="document-option" disabled={busy} onClick={() => gallery.current?.click()}>
              <span className="option-symbol"><Images aria-hidden="true" /></span>
              <span><strong>Escolher Foto da Galeria</strong><small>Receita, cartão de vacina ou convênio</small></span><ChevronRight className="option-arrow" aria-hidden="true" />
            </button>
          </div>
          <button type="button" disabled={busy} className="document-link" onClick={() => switchTo('saved')}><FolderOpen size={20} aria-hidden="true" /> Escolher um cartão salvo</button>
          <p className="document-privacy"><LockKeyhole size={17} aria-hidden="true" /> A foto só é guardada se você escolher salvar.</p>
        </>}

        {view === 'saved' && <>
          <p className="document-intro">Suas receitas e seus cartões guardados neste aparelho.</p>
          {docs.length ? <ul className="document-list">
            {docs.map(doc => <li key={doc.id}>
              {deleteId === doc.id ? <div className="document-delete-confirm">
                <p>Remover <strong>{DOCUMENT_KINDS[doc.kind]}</strong> deste aparelho?</p>
                <div><button type="button" onClick={() => setDeleteId(null)}>Manter foto</button><button type="button" onClick={() => remove(doc.id)}>Sim, remover</button></div>
              </div> : <>
                <button type="button" className="document-saved-item" onClick={() => pickSaved(doc)} aria-label={`Usar ${DOCUMENT_KINDS[doc.kind]}, ${dateLabel(doc.createdAt)}`}>
                  <img src={doc.image} alt="" /><span><strong>{DOCUMENT_KINDS[doc.kind]}</strong><small>{dateLabel(doc.createdAt)}</small></span>
                </button>
                <button type="button" className="document-delete" onClick={() => { setDeleteId(doc.id); setNotice(''); }} aria-label={`Remover ${DOCUMENT_KINDS[doc.kind]}`}><Trash2 size={20} aria-hidden="true" /></button>
              </>}
            </li>)}
          </ul> : <div className="document-empty">
            <span className="option-symbol"><FolderOpen size={30} aria-hidden="true" /></span>
            <h3>Nenhum cartão salvo</h3><p>Escolha uma foto e toque em “Salvar neste aparelho” para encontrá-la aqui depois.</p>
          </div>}
          <button type="button" className="document-primary" onClick={() => switchTo('choose')}><ImagePlus size={22} aria-hidden="true" /> Adicionar uma foto</button>
          <p className="document-privacy"><LockKeyhole size={17} aria-hidden="true" /> Quem usa este navegador pode ver os documentos salvos. Você pode removê-los a qualquer momento.</p>
        </>}

        {view === 'preview' && photo && <>
          <p className="document-intro">Confira se a foto está legível antes de continuar.</p>
          <button type="button" className="document-preview" onClick={() => switchTo('enlarge')} aria-label="Ver a foto ampliada">
            <img src={photo.image} alt={`Pré-visualização: ${DOCUMENT_KINDS[photo.kind]}`} />
            <span><Maximize2 size={15} aria-hidden="true" /> Ampliar</span>
          </button>
          <div className="document-type">
            <label htmlFor="health-document-kind">Tipo de documento</label>
            <div><KindIcon size={20} aria-hidden="true" /><select id="health-document-kind" value={photo.kind} onChange={e => kindChange(e.target.value as DocumentKind)}>
              {Object.entries(DOCUMENT_KINDS).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}
            </select></div>
          </div>
          <DocumentPhotoHandoff key={`${photo.id}:${photo.kind}`} photo={photo} />
          <div className="document-tools">
            <button type="button" onClick={save} disabled={!!saved}>{saved ? <Check size={18} aria-hidden="true" /> : <Save size={18} aria-hidden="true" />}{saved ? 'Salvo neste aparelho' : 'Salvar neste aparelho'}</button>
            <button type="button" onClick={() => { setDraftKind(photo.kind); switchTo('choose'); }}><Images size={18} aria-hidden="true" /> Trocar foto</button>
          </div>
          <p className="document-caption">Salve apenas em um aparelho pessoal.</p>
        </>}

        {view === 'enlarge' && photo && <>
          <img className="document-full-photo" src={photo.image} alt={DOCUMENT_KINDS[photo.kind]} />
          <button type="button" className="document-link" onClick={() => switchTo('preview')}><ArrowLeft size={20} aria-hidden="true" /> Voltar à confirmação</button>
        </>}
        {busy && <p role="status" className="document-feedback"><LoaderCircle size={18} className="animate-spin" /> Preparando a foto...</p>}
        {error && <p role="alert" className="document-feedback error">{error}</p>}
        {notice && <p role="status" className="document-feedback">{notice}</p>}
      </div>
    </dialog>, document.body,
  );
}

export function HealthDocumentActions() {
  const [view, setView] = useState<'choose' | 'saved' | null>(null);
  const close = useCallback(() => setView(null), []);
  return <>
    <div className="health-document-actions" aria-label="Receitas e cartões">
      <button type="button" className="prescription-action" aria-haspopup="dialog" onClick={() => setView('choose')}>
        <Camera aria-hidden="true" size={23} />
        <span><strong>Enviar Foto da Receita</strong><small>Ou cartão de vacina e convênio</small></span>
      </button>
      <button type="button" className="wallet-action" aria-haspopup="dialog" onClick={() => setView('saved')}>
        <FolderOpen aria-hidden="true" size={21} /> Meus Cartões Salvos
      </button>
    </div>
    {view && <HealthDocumentDialog initialView={view} onClose={close} />}
  </>;
}