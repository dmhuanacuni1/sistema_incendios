export default function Campo({ id, etiqueta, ...props }) {
  return (
    <label className="campo" htmlFor={id}>
      <span>{etiqueta}</span>
      <input id={id} {...props} />
    </label>
  );
}
