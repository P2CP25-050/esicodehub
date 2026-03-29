"use client";

import { useRef, useCallback, CSSProperties, DragEvent, ChangeEvent } from "react";

interface FileEntry {
  file: File;
  relativePath: string;
}

interface FileUploadProps {
  files: FileEntry[];
  onFilesChange: (files: FileEntry[]) => void;
}

const MAX_TOTAL_BYTES = 50 * 1024 * 1024; // 50 MB

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function stripRootFolder(path: string): string {
  // e.g. "project/src/main.py" → "src/main.py"
  const parts = path.split("/");
  if (parts.length > 1) return parts.slice(1).join("/");
  return path;
}

export default function FileUpload({ files, onFilesChange }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);

  const totalSize = files.reduce((sum, e) => sum + e.file.size, 0);
  const overLimit = totalSize > MAX_TOTAL_BYTES;

  const mergeEntries = useCallback(
    (incoming: FileEntry[]) => {
      // deduplicate by relativePath
      const existing = new Map(files.map((e) => [e.relativePath, e]));
      for (const entry of incoming) existing.set(entry.relativePath, entry);
      onFilesChange([...existing.values()]);
    },
    [files, onFilesChange]
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const dropped: FileEntry[] = Array.from(e.dataTransfer.files).map((f) => ({
        file: f,
        relativePath: f.name,
      }));
      mergeEntries(dropped);
    },
    [mergeEntries]
  );

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
      return { file: f, relativePath: stripRootFolder(rawPath) };
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
          (e.currentTarget as HTMLDivElement).style.borderColor = "#2563eb";
          (e.currentTarget as HTMLDivElement).style.background = "#eff6ff";
        }}
        onDragLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "#d1d9e6";
          (e.currentTarget as HTMLDivElement).style.background = "#f8faff";
        }}
        onDrop={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "#d1d9e6";
          (e.currentTarget as HTMLDivElement).style.background = "#f8faff";
          handleDrop(e);
        }}
      >
        <div style={styles.dropIcon}>
          <svg width="44" height="44" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M30 4H12C10.9391 4 9.92172 4.42143 9.17157 5.17157C8.42143 5.92172 8 6.93913 8 8V40C8 41.0609 8.42143 42.0783 9.17157 42.8284C9.92172 43.5786 10.9391 44 12 44H36C37.0609 44 38.0783 43.5786 38.8284 42.8284C39.5786 42.0783 40 41.0609 40 40V14L30 4Z" stroke="#4285F4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M28 4V12C28 13.0609 28.4214 14.0783 29.1716 14.8284C29.9217 15.5786 30.9391 16 32 16H40" stroke="#4285F4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M24 24V36" stroke="#4285F4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M30 30L24 24L18 30" stroke="#4285F4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p style={styles.dropText}>Drag &amp; drop files or a folder here</p>
        <p style={styles.dropHint}>Any file type · Max 50 MB total</p>

        {/* Action buttons */}
        <div style={styles.buttonRow}>
          <button
            type="button"
            style={styles.btn}
            onClick={() => fileInputRef.current?.click()}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload Files
          </button>
          <button
            type="button"
            style={{ ...styles.btn, ...styles.btnSecondary }}
            onClick={() => dirInputRef.current?.click()}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            Upload Directory
          </button>
        </div>

        {/* Hidden inputs */}
        <input ref={fileInputRef} type="file" multiple style={{ display: "none" }} onChange={handleFileChange} />
        <input
          ref={dirInputRef}
          type="file"
          multiple
          // @ts-ignore – webkitdirectory is non-standard
          webkitdirectory=""
          style={{ display: "none" }}
          onChange={handleDirChange}
        />
      </div>

      {/* Warning banner */}
      {overLimit && (
        <div style={styles.warning}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={styles.footer}>
            <span style={styles.footerCount}>
              {files.length} {files.length === 1 ? "file" : "files"}
            </span>
            <span style={{ ...styles.footerSize, ...(overLimit ? styles.footerSizeOver : {}) }}>
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
    gap: 12,
    fontFamily: "'Geist', 'Inter', system-ui, sans-serif",
  },
  dropzone: {
    border: "2px dashed #d1d9e6",
    borderRadius: 12,
    padding: "32px 24px 24px",
    textAlign: "center",
    cursor: "default",
    transition: "border-color .2s, background .2s",
    background: "#f8faff",
  },
  dropIcon: { display: "flex", justifyContent: "center", marginBottom: 12 },
  dropText: { fontSize: 14, color: "#374151", margin: "0 0 4px", fontWeight: 500 },
  dropHint: { fontSize: 12, color: "#94a3b8", margin: "0 0 18px" },
  buttonRow: { display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" },
  btn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 16px",
    borderRadius: 8,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background .15s",
  },
  btnSecondary: {
    background: "#fff",
    color: "#374151",
    border: "1px solid #d1d9e6",
  },
  warning: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 8,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#92400e",
    fontSize: 13,
    fontWeight: 500,
  },
  fileList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  fileItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 12px",
    background: "#f0f6ff",
    borderRadius: 8,
    border: "1px solid #dbeafe",
  },
  fileInfo: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 1,
  },
  fileName: {
    fontSize: 13,
    fontWeight: 500,
    color: "#1e3a5f",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  filePath: {
    fontSize: 11,
    color: "#64748b",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontFamily: "monospace",
  },
  fileSize: { fontSize: 12, color: "#64748b", whiteSpace: "nowrap" },
  fileRemove: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "none",
    border: "none",
    color: "#94a3b8",
    cursor: "pointer",
    padding: 4,
    borderRadius: 4,
    lineHeight: 1,
    flexShrink: 0,
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 2px 0",
    borderTop: "1px solid #e2e8f0",
  },
  footerCount: { fontSize: 12, color: "#64748b" },
  footerSize: { fontSize: 12, fontWeight: 600, color: "#374151" },
  footerSizeOver: { color: "#b45309" },
};