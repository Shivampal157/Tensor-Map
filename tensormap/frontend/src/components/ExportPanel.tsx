import axios from 'axios';
import toast from 'react-hot-toast';

export function ExportPanel({ runId }: { runId: number | null }) {
  const download = async (format: string) => {
    if (runId == null) {
      toast.error('Train a model first.');
      return;
    }
    try {
      const { data } = await axios.post<{ file_path: string; export_id: number }>(
        '/api/export',
        { run_id: runId, format },
      );
      const url = `/api/export/${data.export_id}/download`;
      window.open(url, '_blank');
      toast.success(`Export ready (${format})`);
    } catch (e) {
      let msg = 'Export failed';
      if (axios.isAxiosError(e)) {
        const d = e.response?.data as { error?: string; detail?: string } | undefined;
        msg = `${d?.error ?? msg}: ${d?.detail ?? e.message}`;
      }
      toast.error(msg);
    }
  };

  const disabled = runId == null;

  return (
    <div className="panel-section">
      <h3>Export</h3>
      <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', margin: '0 0 10px 0', lineHeight: 1.4 }}>
        PDF / Word = readable summary. ONNX · TFLite · SavedModel = for apps and deployment.
      </p>
      <button
        type="button"
        className="btn btn-export"
        disabled={disabled}
        onClick={() => void download('pdf')}
      >
        Export report (PDF)
      </button>
      <button
        type="button"
        className="btn btn-export"
        disabled={disabled}
        onClick={() => void download('docx')}
      >
        Export report (Word)
      </button>
      <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '14px 0' }} />
      <button
        type="button"
        className="btn btn-export"
        disabled={disabled}
        onClick={() => void download('savedmodel')}
      >
        Export SavedModel
      </button>
      <button
        type="button"
        className="btn btn-export"
        disabled={disabled}
        onClick={() => void download('onnx')}
      >
        Export ONNX
      </button>
      <button
        type="button"
        className="btn btn-export"
        disabled={disabled}
        onClick={() => void download('tflite')}
      >
        Export TFLite
      </button>
    </div>
  );
}
