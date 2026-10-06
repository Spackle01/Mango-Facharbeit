// Zugriff auf den lokalen Server. Das Sitzungstoken steht im <meta>-Tag der Seite.
export const TOKEN = document.querySelector('meta[name="mango-token"]').content;

export class ApiError extends Error {
  constructor(status, message, data = {}) {
    super(message);
    this.status = status;
    this.hint = data.hint || null;
    this.code = data.code || null;
  }
}

async function request(method, url, body, { raw = false, headers = {} } = {}) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { 'x-mango-token': TOKEN, ...(body !== undefined && !raw ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Keine Verbindung zur App. Läuft das Programm noch?');
  }
  if (!res.ok) {
    let data = {};
    try { data = await res.json(); } catch { /* keine JSON-Antwort */ }
    throw new ApiError(res.status, data.error || `Fehler ${res.status}`, data);
  }
  const type = res.headers.get('content-type') || '';
  return type.includes('application/json') ? res.json() : res;
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body = {}) => request('POST', url, body),
  put: (url, body = {}) => request('PUT', url, body),
  patch: (url, body = {}) => request('PATCH', url, body),
  del: (url) => request('DELETE', url),

  upload(file, onProgress) {
    // XHR für den Upload-Fortschritt.
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/uploads');
      xhr.setRequestHeader('x-mango-token', TOKEN);
      xhr.setRequestHeader('x-filename', encodeURIComponent(file.name));
      xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
      xhr.onload = () => {
        let data = {};
        try { data = JSON.parse(xhr.responseText); } catch { /* leer */ }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new ApiError(xhr.status, data.error || 'Upload fehlgeschlagen'));
      };
      xhr.onerror = () => reject(new ApiError(0, 'Upload fehlgeschlagen – keine Verbindung zur App.'));
      xhr.send(file);
    });
  },

  // Liest einen NDJSON-Stream und ruft onEvent für jedes Ereignis auf.
  async stream(method, url, body, onEvent) {
    const res = await request(method, url, body);
    if (!res.body) throw new ApiError(0, 'Streaming wird nicht unterstützt.');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (line) { try { onEvent(JSON.parse(line)); } catch (err) { console.error(err); } }
      }
    }
    if (buf.trim()) { try { onEvent(JSON.parse(buf)); } catch { /* unvollständig */ } }
  },

  rawUrl(path, download = false) {
    return `/api/files/raw?path=${encodeURIComponent(path)}${download ? '&download=1' : ''}&t=${TOKEN}`;
  },
};
