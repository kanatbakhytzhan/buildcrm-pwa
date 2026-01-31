type ToastProps = {
  message: string
  onClose?: () => void
}

const Toast = ({ message, onClose }: ToastProps) => {
  return (
    <div className="toast">
      <div>{message}</div>
      {onClose && (
        <button className="toast-close" type="button" onClick={onClose}>
          ×
        </button>
      )}
    </div>
  )
}

export default Toast
