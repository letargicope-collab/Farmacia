import { useId, useRef, useState } from 'react';
import { Download, LoaderCircle, MessageCircle } from 'lucide-react';
import { STORE } from '../config/store';
import { documentMessage, type DocumentPhoto } from '../lib/health-documents';
import { waUrl } from '../lib/whatsapp';

type ShareState = 'ready' | 'sharing' | 'cancelled' | 'handed-off' | 'failed';

function attachmentPayload(photo: DocumentPhoto): ShareData | null {
  const attachment = { files: [photo.file] };
  try {
    // Test the file alone first: text-only implementations can ignore unknown fields.
    if (typeof navigator.share !== 'function' || !photo.file.size || !navigator.canShare?.(attachment)) return null;
    const captioned = { ...attachment, text: documentMessage(photo.kind) };
    return navigator.canShare(captioned) ? captioned : attachment;
  } catch {
    return null;
  }
}

export function DocumentPhotoHandoff({ photo }: { photo: DocumentPhoto }) {
  const helpId = useId();
  const inProgress = useRef(false);
  const [state, setState] = useState<ShareState>('ready');
  const [manual, setManual] = useState(false);
  const payload = attachmentPayload(photo);
  const useManual = !payload || manual || state === 'failed';

  const share = async () => {
    if (!payload || inProgress.current) return;
    inProgress.current = true;
    setState('sharing');
    try {
      // The File already exists when the user taps. Do not await decoding before share().
      await navigator.share(payload);
      setState('handed-off');
    } catch (reason) {
      setState(reason instanceof Error && reason.name === 'AbortError' ? 'cancelled' : 'failed');
    } finally {
      inProgress.current = false;
    }
  };

  return (
    <div className="document-handoff">
      {useManual ? (
        <>
          <p className="document-manual-intro" role="status">
            <strong>{state === 'failed' ? 'Não foi possível compartilhar a foto.' : manual ? 'Envio manual da foto' : 'Este navegador não permite anexar a foto diretamente.'}</strong>
            {' '}Baixe a foto, abra a conversa e toque no <strong>+</strong> ou no <strong>clipe</strong> para anexar o arquivo.
          </p>
          <a className="download-document" href={photo.image} download={photo.file.name}>
            <Download size={19} aria-hidden="true" /> 1. Baixar a foto
          </a>
          <a className="document-send" href={waUrl(documentMessage(photo.kind))} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={23} aria-hidden="true" /> 2. Abrir WhatsApp da farmácia
          </a>
          {payload && <button type="button" className="document-link" onClick={() => { setManual(false); setState('ready'); }}>
            Voltar ao envio com anexo
          </button>}
        </>
      ) : (
        <>
          <button type="button" className="document-send" onClick={share} disabled={state === 'sharing'}
            aria-busy={state === 'sharing'} aria-describedby={helpId}>
            {state === 'sharing' ? <LoaderCircle size={23} className="animate-spin" aria-hidden="true" /> : <MessageCircle size={23} aria-hidden="true" />}
            {state === 'sharing' ? 'Abrindo compartilhamento...' : photo.kind === 'prescription' ? 'Enviar Receita no WhatsApp' : 'Enviar no WhatsApp da Farmácia'}
          </button>
          <p id={helpId}>A foto vai como anexo. Escolha <strong>WhatsApp</strong>, selecione <strong>{STORE.name}</strong> ({STORE.whatsappDisplay}) e confirme o envio.</p>
          <div aria-live="polite">
            {state === 'cancelled' && <p>Compartilhamento cancelado. Sua foto continua aqui para tentar novamente.</p>}
            {state === 'handed-off' && <p>Confira na conversa do WhatsApp se a foto foi enviada.</p>}
          </div>
          <button type="button" className="document-link" disabled={state === 'sharing'} onClick={() => setManual(true)}>
            Não encontrei o WhatsApp
          </button>
        </>
      )}
    </div>
  );
}