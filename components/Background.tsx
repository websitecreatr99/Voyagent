export default function Background() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Aurora blobs */}
      <div className="absolute -left-[10%] -top-[20%] h-[60vmax] w-[60vmax] animate-aurora rounded-full bg-violet-600/25 blur-[120px]" />
      <div
        className="absolute -right-[15%] top-[10%] h-[50vmax] w-[50vmax] animate-aurora rounded-full bg-sky-500/20 blur-[120px]"
        style={{ animationDelay: "-6s" }}
      />
      <div
        className="absolute bottom-[-30%] left-[25%] h-[55vmax] w-[55vmax] animate-aurora rounded-full bg-fuchsia-500/[0.15] blur-[140px]"
        style={{ animationDelay: "-12s" }}
      />
      {/* Grid */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse at 50% 0%, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 0%, black 30%, transparent 75%)",
        }}
      />
      {/* Noise vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(5,6,15,0.85)_100%)]" />
    </div>
  );
}
