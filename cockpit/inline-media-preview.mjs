// Private thumbnail bytes travel with the authenticated media record. Originals
// remain in SharePoint; this is never an outbound link or an executable format.
export function safeInlineMediaPreview(value) {
  if (typeof value !== 'string' || value.length > 220000) return '';
  const prefix = 'data:image/jpeg;base64,';
  if (!value.startsWith(prefix)) return '';
  const bytes = value.slice(prefix.length);
  if (bytes.length < 8 || bytes.length % 4 !== 0 || !bytes.startsWith('/9j/')) return '';
  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(bytes) ? value : '';
}
