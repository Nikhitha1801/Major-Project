export default function CampusBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a2540] via-[#101a30] to-[#070b18]" />

      <svg
        className="absolute bottom-0 left-0 w-full h-[60%] opacity-40"
        viewBox="0 0 1600 500"
        preserveAspectRatio="xMidYMax slice"
        fill="none"
      >
        {/* Trees */}
        <ellipse cx="120" cy="260" rx="70" ry="95" fill="#233252" />
        <ellipse cx="200" cy="300" rx="55" ry="75" fill="#1c2947" />
        <rect x="112" y="300" width="14" height="90" fill="#1c2947" />
        <rect x="192" y="340" width="12" height="70" fill="#182238" />

        {/* Building block grid, left */}
        <rect x="230" y="180" width="360" height="320" fill="#141d34" />
        {Array.from({ length: 6 }).map((_, row) =>
          Array.from({ length: 8 }).map((_, col) => (
            <rect
              key={`l-${row}-${col}`}
              x={250 + col * 42}
              y={205 + row * 42}
              width={26}
              height={26}
              rx={2}
              fill="#2a3a5c"
              opacity={0.5}
            />
          )),
        )}

        {/* Building block grid, right */}
        <rect x="1010" y="150" width="380" height="350" fill="#141d34" />
        {Array.from({ length: 7 }).map((_, row) =>
          Array.from({ length: 8 }).map((_, col) => (
            <rect
              key={`r-${row}-${col}`}
              x={1030 + col * 42}
              y={175 + row * 42}
              width={26}
              height={26}
              rx={2}
              fill="#2a3a5c"
              opacity={0.5}
            />
          )),
        )}

        {/* Right trees */}
        <ellipse cx="1440" cy="270" rx="60" ry="85" fill="#233252" />
        <rect x="1432" y="305" width="14" height="80" fill="#1c2947" />

        {/* Ground line */}
        <rect x="0" y="480" width="1600" height="20" fill="#0b1120" opacity="0.7" />
      </svg>

      {/* Ambient blobs */}
      <div className="absolute top-[8%] left-[12%] w-72 h-72 rounded-full bg-brand-500/10 blur-[100px]" />
      <div className="absolute bottom-[10%] right-[10%] w-80 h-80 rounded-full bg-violet-500/10 blur-[110px]" />

      <div className="absolute inset-0 bg-ink-950/45" />
    </div>
  )
}
