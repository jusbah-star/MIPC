export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requiredText(value: unknown, label: string, maxLength: number, minLength = 1) {
  if (typeof value !== 'string') throw new ValidationError(`${label} is required.`);
  const cleaned = value.trim();
  if (cleaned.length < minLength) throw new ValidationError(`${label} is too short.`);
  if (cleaned.length > maxLength) throw new ValidationError(`${label} must be ${maxLength} characters or fewer.`);
  return cleaned;
}

export function optionalText(value: unknown, label: string, maxLength: number) {
  if (value == null || value === '') return null;
  return requiredText(value, label, maxLength);
}

export function emailAddress(value: unknown) {
  const email = requiredText(value, 'Email address', 320, 5).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw new ValidationError('Enter a valid email address.');
  return email;
}

export function uuid(value: unknown, label = 'Identifier') {
  const id = requiredText(value, label, 36, 36);
  if (!UUID_PATTERN.test(id)) throw new ValidationError(`${label} is invalid.`);
  return id;
}

export function booleanTrue(value: unknown, label: string) {
  if (value !== true) throw new ValidationError(`${label} is required.`);
  return true;
}

export function jsonBodySize(request: Request, maxBytes: number) {
  const rawLength = request.headers.get('content-length');
  if (rawLength && Number(rawLength) > maxBytes) throw new ValidationError('Request is too large.');
}
