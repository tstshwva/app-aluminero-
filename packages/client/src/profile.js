// Datos de contacto que el comprador puede guardar en usuarios/{uid}. Deben
// coincidir con validProfile() en firestore.rules.
const fail = (field, message) => {
  throw Object.assign(new Error(message), { field });
};

export function profileFields(body) {
  const value = (key, max) =>
    String(body[key] ?? "")
      .trim()
      .slice(0, max);
  const phone = value("phone", 25);
  if (
    !/^[0-9 +()-]{10,25}$/.test(phone) ||
    !/^\d{10,15}$/.test(phone.replace(/\D/g, ""))
  )
    fail("phone", "Escribe un teléfono de 10 a 15 dígitos.");
  const taxId = value("taxId", 13).toUpperCase();
  if (taxId && !/^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/u.test(taxId))
    fail("taxId", "Escribe un RFC válido o deja el campo vacío.");
  return {
    phone,
    business_name: value("businessName", 160),
    tax_id: taxId,
    address: value("address", 500),
  };
}
