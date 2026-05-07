export const generateSecureHex = (len) => {
  const arr = new Uint8Array(len / 2);
  crypto.getRandomValues(arr);
  return Array.from(arr, dec => dec.toString(16).padStart(2, '0')).join('');
};