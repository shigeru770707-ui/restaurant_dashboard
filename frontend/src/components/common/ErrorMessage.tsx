interface ErrorMessageProps {
  message?: string
}

export default function ErrorMessage({ message = 'データの取得に失敗しました' }: ErrorMessageProps) {
  return (
    <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-danger/20 bg-danger-bg p-6">
      <p className="text-sm text-danger">{message}</p>
    </div>
  )
}
