import { useRef, CSSProperties, DragEvent, ChangeEvent } from "react";

interface FileEntry {
  file: File;
  relativePath: string;
}

interface FileUploadProps {
  files: FileEntry[];
  onFilesChange: (files: FileEntry[]) => void;
}

const MAX_TOTAL_BYTES = 50 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function normalizeRelativePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

export default function FileUpload({ files, onFilesChange }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);

  const totalSize = files.reduce((sum, e) => sum + e.file.size, 0);
  const overLimit = totalSize > MAX_TOTAL_BYTES;

  const mergeEntries = (incoming: FileEntry[]) => {
    const existing = new Map(files.map((e) => [e.relativePath, e]));
    for (const entry of incoming) existing.set(entry.relativePath, entry);
    onFilesChange([...existing.values()]);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped: FileEntry[] = Array.from(e.dataTransfer.files).map((f) => ({
      file: f,
      relativePath: f.name,
    }));
    mergeEntries(dropped);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const entries: FileEntry[] = Array.from(e.target.files).map((f) => ({
      file: f,
      relativePath: f.name,
    }));
    mergeEntries(entries);
    e.target.value = "";
  };

  const handleDirChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const entries: FileEntry[] = Array.from(e.target.files).map((f) => {
      const rawPath = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
      return { file: f, relativePath: normalizeRelativePath(rawPath) };
    });
    mergeEntries(entries);
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <div style={styles.wrapper}>
      {/* Drop zone */}
      <div
        style={styles.dropzone}
        onDragOver={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLDivElement).style.borderColor = "#051650";
          (e.currentTarget as HTMLDivElement).style.background = "#f0f4ff";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "3px 3px 0 #051650";
        }}
        onDragLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "#000";
          (e.currentTarget as HTMLDivElement).style.background = "#fafafa";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
        }}
        onDrop={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "#000";
          (e.currentTarget as HTMLDivElement).style.background = "#fafafa";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
          handleDrop(e);
        }}
      >
        {/* Upload icon */}
        <div style={styles.dropIconWrap}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#051650" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>

        <p style={styles.dropText}>Drag &amp; drop files or a folder here</p>
        <p style={styles.dropHint}>Text / code files only · Max 50 MB total</p>

        <div style={styles.buttonRow}>
          <button type="button" style={styles.btn} onClick={() => fileInputRef.current?.click()}>
            Upload Files
          </button>
          <button type="button" style={{ ...styles.btn, ...styles.btnGhost }} onClick={() => dirInputRef.current?.click()}>
            Upload Directory
          </button>
        </div>

        <input ref={fileInputRef} type="file" multiple style={{ display: "none" }} onChange={handleFileChange} />
        <input
          ref={dirInputRef}
          type="file"
          multiple
          // @ts-expect-error – non-standard
          webkitdirectory=""
          style={{ display: "none" }}
          onChange={handleDirChange}
        />
      </div>

      {/* Warning */}
      {overLimit && (
        <div style={styles.warning}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          Total size ({formatSize(totalSize)}) exceeds the 50 MB limit. Please remove some files.
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <>
          <div style={styles.fileList}>
            {files.map((entry, i) => (
              <div key={i} style={styles.fileItem}>
                <div style={styles.fileInfo}>
                  <span style={styles.fileName}>{entry.file.name}</span>
                  {entry.relativePath !== entry.file.name && (
                    <span style={styles.filePath}>{entry.relativePath}</span>
                  )}
                </div>
                <span style={styles.fileSize}>{formatSize(entry.file.size)}</span>
                <button type="button" style={styles.fileRemove} onClick={() => removeFile(i)} aria-label="Remove file">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <div style={styles.footer}>
            <span style={styles.footerCount}>
              {files.length} {files.length === 1 ? "file" : "files"}
            </span>
            <span style={{ ...styles.footerSize, ...(overLimit ? styles.footerOver : {}) }}>
              {formatSize(totalSize)} {overLimit ? "⚠ over limit" : "/ 50 MB"}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    fontFamily: "'DM Sans', sans-serif",
  },
  dropzone: {
    border: "1.5px dashed #000",
    padding: "28px 20px 22px",
    textAlign: "center",
    background: "#fafafa",
    cursor: "default",
    transition: "border-color .15s, background .15s, box-shadow .15s",
  },
  dropIconWrap: {
    display: "flex",
    justifyContent: "center",
    marginBottom: 10,
  },
  dropText: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 13,
    fontWeight: 500,
    color: "#111",
    margin: "0 0 4px",
  },
  dropHint: {
    fontFamily: "'Space Mono', monospace",
    fontSize: 10,
    color: "#9ca3af",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    margin: "0 0 16px",
  },
  buttonRow: {
    display: "flex",
    gap: 8,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  btn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 18px",
    border: "1.5px solid #051650",
    background: "#051650",
    color: "#fff",
    fontFamily: "'Space Mono', monospace",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    cursor: "pointer",
    transition: "background .15s, color .15s",
  },
  btnGhost: {
    background: "transparent",
    color: "#051650",
  },
  warning: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "9px 12px",
    border: "1.5px solid #000",
    borderLeft: "4px solid #b45309",
    background: "#fff8f0",
    color: "#92400e",
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 12,
    fontWeight: 500,
  },
  fileList: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  fileItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    background: "#f0f4ff",
    border: "1px solid #c7d2fe",
    borderLeft: "3px solid #051650",
  },
  fileInfo: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 1,
  },
  fileName: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 12,
    fontWeight: 600,
    color: "#051650",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  filePath: {
    fontFamily: "'Space Mono', monospace",
    fontSize: 10,
    color: "#64748b",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  fileSize: {
    fontFamily: "'Space Mono', monospace",
    fontSize: 10,
    color: "#64748b",
    whiteSpace: "nowrap",
  },
  fileRemove: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "none",
    border: "none",
    color: "#9ca3af",
    cursor: "pointer",
    padding: 4,
    lineHeight: 1,
    flexShrink: 0,
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTop: "1px solid #e5e7eb",
  },
  footerCount: {
    fontFamily: "'Space Mono', monospace",
    fontSize: 10,
    color: "#9ca3af",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  footerSize: {
    fontFamily: "'Space Mono', monospace",
    fontSize: 10,
    fontWeight: 700,
    color: "#374151",
    letterSpacing: "0.05em",
  },
  footerOver: { color: "#b45309" },
};