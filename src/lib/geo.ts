/* ============================================================================
 *  LOCALIZAÇÃO DO CLIENTE
 *  • GPS (Geolocation API)      → link exato do Google Maps
 *  • Nominatim (OpenStreetMap)  → sugestão de rua/bairro a partir do GPS
 *  • ViaCEP                     → preenchimento automático pelo CEP
 * ==========================================================================*/

export interface GeoPosition {
  lat: number;
  lng: number;
  accuracy: number;
}

export interface AddressGuess {
  street?: string;
  number?: string;
  district?: string;
  city?: string;
  uf?: string;
  cep?: string;
  label?: string;
}

function geoErrorMessage(code: number): string {
  if (code === 1)
    return 'Você não permitiu o acesso à localização. Toque no cadeado 🔒 ao lado do endereço do site, permita a "Localização" e tente de novo — ou preencha o endereço abaixo.';
  if (code === 3) return 'A localização demorou demais. Verifique se o GPS está ligado e tente novamente.';
  return 'Não foi possível obter sua localização agora. Verifique se o GPS do celular está ligado.';
}

export function getCurrentPosition(): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      reject(new Error('Este aparelho não permite obter a localização. Preencha o endereço abaixo.'));
      return;
    }
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      reject(new Error('A localização só funciona com o site aberto em https://. Preencha o endereço abaixo.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => reject(new Error(geoErrorMessage(err.code))),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}

const UF_BY_STATE: Record<string, string> = {
  acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA', ceara: 'CE', 'distrito federal': 'DF',
  'espirito santo': 'ES', goias: 'GO', maranhao: 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS',
  'minas gerais': 'MG', para: 'PA', paraiba: 'PB', parana: 'PR', pernambuco: 'PE', piaui: 'PI',
  'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondonia: 'RO', roraima: 'RR',
  'santa catarina': 'SC', 'sao paulo': 'SP', sergipe: 'SE', tocantins: 'TO',
};
const plain = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

async function fetchJson(url: string, ms = 8000): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<AddressGuess | null> {
  try {
    const j = (await fetchJson(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=pt-BR`,
    )) as { address?: Record<string, string>; display_name?: string } | null;
    if (!j || !j.address) return null;
    const a = j.address;
    const iso = a['ISO3166-2-lvl4'] || '';
    return {
      street: a.road || a.pedestrian || a.footway || a.residential || '',
      number: a.house_number || '',
      district: a.suburb || a.neighbourhood || a.quarter || a.city_district || '',
      city: a.city || a.town || a.village || a.municipality || '',
      uf: iso.startsWith('BR-') ? iso.slice(3) : UF_BY_STATE[plain(a.state || '')] || '',
      cep: a.postcode || '',
      label: j.display_name,
    };
  } catch {
    return null;
  }
}

export async function lookupCep(cep: string): Promise<AddressGuess | null> {
  const d = cep.replace(/\D/g, '');
  if (d.length !== 8) return null;
  try {
    const j = (await fetchJson(`https://viacep.com.br/ws/${d}/json/`)) as Record<string, string> | null;
    if (!j || j.erro) return null;
    return { street: j.logradouro, district: j.bairro, city: j.localidade, uf: j.uf, cep: j.cep };
  } catch {
    return null;
  }
}
