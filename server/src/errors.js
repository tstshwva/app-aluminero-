export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function fields(body, allowed) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some((k) => !allowed.includes(k))
  )
    throw new ApiError(400, "La solicitud contiene campos inválidos.");
}
export function text(value, max) {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= max
    ? value.trim()
    : null;
}
export function email(value) {
  const result = text(value, 254)?.toLowerCase();
  return result && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u.test(result)
    ? result
    : null;
}
export const validPassword = (value) =>
  typeof value === "string" && value.length >= 12 && value.length <= 128;
export function phone(value) {
  const result = text(value, 25);
  return result &&
    /^[0-9 +()\-]+$/.test(result) &&
    (result.match(/[0-9]/g)?.length ?? 0) >= 10 &&
    (result.match(/[0-9]/g)?.length ?? 0) <= 15
    ? result
    : null;
}
export function id(value) {
  if (
    typeof value !== "string" ||
    !/^[1-9][0-9]{0,19}$/.test(value) ||
    BigInt(value) > 9223372036854775807n
  )
    throw new ApiError(400, "Identificador inválido.");
  return value;
}
export const isStaff = (user) =>
  ["Administrador", "Operador"].includes(user.role);
export function requireRole(user, roles) {
  if (!user) throw new ApiError(401, "Inicia sesión para continuar.");
  if (roles && !roles.includes(user.role))
    throw new ApiError(403, "Tu cuenta no tiene permiso para esta operación.");
}
