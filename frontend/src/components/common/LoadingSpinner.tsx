export default function LoadingSpinner() {
  return (
    <div className="flex min-h-[300px] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
    </div>
  )
}
