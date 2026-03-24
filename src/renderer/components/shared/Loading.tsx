export default function Loading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 h-full">
      <svg width="48" height="48" viewBox="0 0 48 48" style={{ animation: 'md3-spin 1.4s linear infinite' }}>
        <circle
          cx="24"
          cy="24"
          r="20"
          fill="none"
          stroke="var(--md-primary-40)"
          strokeWidth="4"
          strokeLinecap="round"
          style={{ animation: 'md3-dash 1.4s ease-in-out infinite' }}
        />
      </svg>
      <p className="text-body-medium" style={{ color: 'var(--md-on-surface-variant)' }}>{message}</p>
    </div>
  )
}
