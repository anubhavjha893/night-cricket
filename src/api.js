export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status, errors) { super(message); this.status = status; this.errors = errors; }
}

export async function api(endpoint, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}/api${endpoint}`, {
      method, credentials: 'include', signal,
      headers: body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('The registration service is unavailable. Please try again shortly.', 503);
  }
  if (!response.headers.get('content-type')?.includes('application/json')) throw new ApiError('The registration service is not connected yet. Please try again later.', 503);
  const data = await response.json();
  if (!response.ok) throw new ApiError(data.message || 'Request failed. Please try again.', response.status, data.errors);
  return data;
}

export const fallbackConfig = {
  name: 'Urmila Gupta Memorial Cricket Tournament', season: 2, fee: 150,
  venue: 'Tenughat Golden Jubilee Ground', opensAt: '2026-11-24T00:00:00+05:30', closesAt: '2026-12-21T00:00:00+05:30',
  registration: { isOpen: false, message: '24 November – 20 December 2026' },
  payment: { configured: true, payeeName: 'Anubhav Jha', upiId: '8210708838sbi@axl', amount: 150, qrUrl: '/api/payment/qr' },
};
