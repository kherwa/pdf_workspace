export default function Loading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 h-full">
      <svg className="spinner-lg" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="20" fill="none" stroke="var(--md-primary-40)" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <p className="text-body-medium text-on-surface-variant">{message}</p>
    </div>
  )
}
