"use client";

import { useRef, useCallback, CSSProperties, DragEvent, ChangeEvent } from "react";
interface FileUploadProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
}

export default function FileUpload({ files, onFilesChange }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  

  // We manage dragging state locally via inline logic
  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const dropped = Array.from(e.dataTransfer.files);
      onFilesChange([...files, ...dropped]);
    },
    [files, onFilesChange]
  );

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    onFilesChange([...files, ...Array.from(e.target.files)]);
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <>
      <div
        style={styles.dropzone}
        onDragOver={(e) => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.borderColor = "#2563eb"; (e.currentTarget as HTMLDivElement).style.background = "#eff6ff"; }}
        onDragLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#d1d9e6"; (e.currentTarget as HTMLDivElement).style.background = "#f8faff"; }}
        onDrop={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#d1d9e6"; (e.currentTarget as HTMLDivElement).style.background = "#f8faff"; handleDrop(e); }}
        onClick={() => fileInputRef.current?.click()}
      >
        <div style={styles.dropIcon}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M30 4H12C10.9391 4 9.92172 4.42143 9.17157 5.17157C8.42143 5.92172 8 6.93913 8 8V40C8 41.0609 8.42143 42.0783 9.17157 42.8284C9.92172 43.5786 10.9391 44 12 44H36C37.0609 44 38.0783 43.5786 38.8284 42.8284C39.5786 42.0783 40 41.0609 40 40V14L30 4Z" stroke="#4285F4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M28 4V12C28 13.0609 28.4214 14.0783 29.1716 14.8284C29.9217 15.5786 30.9391 16 32 16H40" stroke="#4285F4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M24 24V36" stroke="#4285F4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M30 30L24 24L18 30" stroke="#4285F4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p style={styles.dropText}>
          <span style={styles.dropLink}>Click to upload</span> or drag &amp; drop files here
        </p>
        <p style={styles.dropHint}>Any file type · Max 25 MB each</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      </div>

      {files.length > 0 && (
        <div style={styles.fileList}>
          {files.map((f, i) => (
            <div key={i} style={styles.fileItem}>
              <span style={styles.fileIcon}>📄</span>
              <span style={styles.fileName}>{f.name}</span>
              <span style={styles.fileSize}>{(f.size / 1024).toFixed(1)} KB</span>
              <button type="button" style={styles.fileRemove} onClick={() => removeFile(i)}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  dropzone: {
    border: "2px dashed #d1d9e6",
    borderRadius: 12,
    padding: "36px 24px",
    textAlign: "center",
    cursor: "pointer",
    transition: "border-color .2s, background .2s",
    background: "#f8faff",
  },
  dropIcon: { fontSize: 36, marginBottom: 10, display: "flex", justifyContent: "center" },
  dropText: { fontSize: 14, color: "#374151", margin: "0 0 4px" },
  dropLink: { color: "#2563eb", fontWeight: 600 },
  dropHint: { fontSize: 12, color: "#94a3b8", margin: 0 },
  fileList: { marginTop: 12, display: "flex", flexDirection: "column", gap: 8 },
  fileItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 14px",
    background: "#f0f6ff",
    borderRadius: 8,
    border: "1px solid #dbeafe",
  },
  fileIcon: { fontSize: 16 },
  fileName: {
    flex: 1,
    fontSize: 13,
    fontWeight: 500,
    color: "#1e3a5f",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  fileSize: { fontSize: 12, color: "#64748b" },
  fileRemove: {
    background: "none",
    border: "none",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: 14,
    padding: "0 4px",
    lineHeight: 1,
  },
};