export const DOCUMENT_KEY = 'fsm:health-documents:v1';
export const DOCUMENT_KINDS = {
  prescription: 'Receita médica',
  vaccine: 'Cartão de vacina',
  insurance: 'Cartão do convênio',
} as const;
export type DocumentKind = keyof typeof DOCUMENT_KINDS;

export interface SavedDocument {
  id: string;
  kind: DocumentKind;
  createdAt: number;
  image: string;
}
export interface DocumentPhoto extends SavedDocument {
  file: File;
}

export function documentMessage(kind: DocumentKind) {
  if (kind === 'prescription') return 'Olá! Gostaria de fazer um pedido com esta receita médica.';
  if (kind === 'insurance') return 'Olá! Estou enviando a foto do meu cartão do convênio para atendimento.';
  return 'Olá! Estou enviando a foto da minha receita / cartão de vacina para atendimento.';
}

const readError = 'Não foi possível ler os cartões salvos neste navegador. Você ainda pode enviar uma nova foto.';

function validDocument(value: unknown): value is SavedDocument {
  if (!value || typeof value !== 'object') return false;
  const d = value as Partial<SavedDocument>;
  return typeof d.id === 'string' && typeof d.kind === 'string' && Object.prototype.hasOwnProperty.call(DOCUMENT_KINDS, d.kind)
    && typeof d.createdAt === 'number' && Number.isFinite(d.createdAt)
    && typeof d.image === 'string' && d.image.length <= 4_000_000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(d.image);
}

export function readDocuments(): SavedDocument[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(DOCUMENT_KEY) || '[]');
    if (!Array.isArray(data) || !data.every(validDocument)) throw new Error();
    return data;
  } catch {
    throw new Error(readError);
  }
}

export function saveDocument(photo: DocumentPhoto) {
  const { id, kind, createdAt, image } = photo;
  const docs = [{ id, kind, createdAt, image }, ...readDocuments().filter(d => d.id !== id)];
  const data = JSON.stringify(docs);
  if (data.length > 4_000_000 || docs.length > 12) {
    throw new Error('Não há espaço para outra foto. Remova um cartão salvo ou envie a foto sem guardar.');
  }
  try { localStorage.setItem(DOCUMENT_KEY, data); }
  catch { throw new Error('Não foi possível salvar neste aparelho. Você pode enviar a foto sem guardá-la.'); }
  return docs;
}

export function removeDocument(id: string) {
  const docs = readDocuments().filter(d => d.id !== id);
  try {
    if (docs.length) localStorage.setItem(DOCUMENT_KEY, JSON.stringify(docs));
    else localStorage.removeItem(DOCUMENT_KEY);
  } catch { throw new Error('Não foi possível remover o cartão. Tente novamente neste navegador.'); }
  return docs;
}

export function documentFile(doc: SavedDocument): File {
  const bytes = Uint8Array.from(atob(doc.image.split(',')[1]), c => c.charCodeAt(0));
  const names: Record<DocumentKind, string> = { prescription: 'receita', vaccine: 'cartao-de-vacina', insurance: 'cartao-de-convenio' };
  return new File([bytes], `${names[doc.kind]}.jpg`, { type: 'image/jpeg' });
}

export async function preparePhoto(file: File, kind: DocumentKind = 'prescription'): Promise<DocumentPhoto> {
  const accepted = /^image\/(jpeg|jpg|png|webp|avif|heic|heif)$/i;
  if (!accepted.test(file.type) && !(file.type === '' && /\.(jpe?g|png|webp|avif|hei[cf])$/i.test(file.name))) {
    throw new Error('Escolha uma foto da receita ou do cartão, não um PDF ou outro documento.');
  }
  if (!file.size || file.size > 20 * 1024 * 1024) throw new Error('Selecione uma foto de até 20 MB ou tire uma nova foto.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth * img.naturalHeight > 100_000_000) throw new Error();
    // Re-encoding drops location metadata and keeps the local copy small enough for phone storage.
    const scale = Math.min(1, 1920 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error();
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    const photo: SavedDocument = {
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      kind, createdAt: Date.now(), image: canvas.toDataURL('image/jpeg', .86),
    };
    return { ...photo, file: documentFile(photo) };
  } catch {
    throw new Error('Esta foto não abriu. Tente uma imagem JPG ou PNG, ou tire uma nova foto.');
  } finally { URL.revokeObjectURL(url); }
}