export const REGLA_CONTRASENA =
  "La contraseña debe tener al menos 8 caracteres, una mayúscula, un número y un carácter especial";

function esMayuscula(caracter) {
  return caracter !== caracter.toLowerCase() && caracter === caracter.toUpperCase();
}

export function contrasenaValida(contrasena) {
  if (typeof contrasena !== "string" || contrasena.length < 8 || contrasena.length > 128) return false;
  const caracteres = [...contrasena];
  return (
    caracteres.some(esMayuscula) &&
    caracteres.some((caracter) => /\p{N}/u.test(caracter)) &&
    caracteres.some((caracter) => !/[\p{L}\p{N}]/u.test(caracter))
  );
}
