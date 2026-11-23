import Modal from "./Modal";
import Button from "./Button";

export default function ConfirmDialog({ open, title, message, confirmLabel = "Delete", onConfirm, onCancel, loading, variant = "danger" }) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{message}</p>
    </Modal>
  );
}
