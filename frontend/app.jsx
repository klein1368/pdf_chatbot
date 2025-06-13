import React, { useState } from "react";
import axios from "axios";
import { Viewer, Worker } from "@react-pdf-viewer/core";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "./index.css";

function App() {
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState("");
  const [pdfBase64, setPdfBase64] = useState("");
  const [fileType, setFileType] = useState("");
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState("");
  const [fileId, setFileId] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    setFile(uploadedFile);
    setFileType(uploadedFile.type);

    const formData = new FormData();
    formData.append("file", uploadedFile);

    try {
      const res = await axios.post("http://localhost:5000/upload", formData);
      setPreviewData(res.data.preview);
      setPdfBase64(res.data.base64 || "");
      setFileId(res.data.fileId);
    } catch (error) {
      console.error("Upload error:", error);
    }
  };

  const handleSend = async () => {
    if (!query || !fileId) return;
    const newMessages = [...messages, { type: "user", text: query }];
    setMessages(newMessages);
    setQuery("");
    setLoading(true);

    try {
      const res = await axios.post("http://localhost:5000/query", {
        fileId,
        question: query,
      });
      setMessages([
        ...newMessages,
        { type: "bot", text: res.data.response },
      ]);
    } catch (err) {
      console.error("Query error:", err);
      setMessages([
        ...newMessages,
        { type: "bot", text: "Error getting response." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="upload-section">
        <h2>Upload a Data File</h2>
        <input type="file" accept=".csv,.xlsx,.txt,.pdf" onChange={handleFileUpload} />
        {previewData && (
          <div style={{ marginTop: "15px" }}>
            <h4>File Preview:</h4>
            {fileType === "application/pdf" && pdfBase64 ? (
              <div style={{ height: "500px", border: "1px solid #ccc" }}>
                <Worker workerUrl={`https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`}>
                  <Viewer fileUrl={`data:application/pdf;base64,${pdfBase64}`} />
                </Worker>
              </div>
            ) : (
              <pre style={{
                whiteSpace: "pre-wrap",
                background: "#f9f9f9",
                padding: "1em",
                borderRadius: "8px"
              }}>
                {previewData}
              </pre>
            )}
          </div>
        )}
      </div>

      <div className="chat-container">
        <h2>Ask Questions About Your Data</h2>

        <div className="chat-box">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`chat-row ${msg.type === "user" ? "user-row" : "bot-row"}`}
            >
              <div className={`chat-bubble ${msg.type === "user" ? "user-message" : "bot-message"}`}>
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        <div className="chat-input">
          <input
            type="text"
            placeholder="Ask a question..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button onClick={handleSend} disabled={loading}>
            {loading ? "Thinking..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
