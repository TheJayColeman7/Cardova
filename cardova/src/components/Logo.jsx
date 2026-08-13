export default function Logo({ variant = "dark", compact = false }) {
  const src = variant === "light" ? "/logo-light.jpg" : "/logo-dark.jpg";

  return (
    <img
      src={src}
      alt="Sweet Home Sports Cards"
      className={`w-auto object-contain ${compact ? "h-11 sm:h-12" : "h-12 sm:h-14"}`}
    />
  );
}
