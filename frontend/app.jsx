const express = require("express");
const cors = require("cors");
const multer = require("multer");
const xlsx = require("xlsx");
const fs = require("fs");
const Papa = require("papaparse");
const pdfParse = require("pdf-parse");
const bodyParser = require("body-parser");
// const fetch = require("node-fetch");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
 // ✅ add this
require("dotenv").config();

const app = express();
const port = 5000;

app.use(cors());
app.use(bodyParser.json());

const upload = multer({ dest: "uploads/" });
const fileStore = {}; // In-memory cache



app.post("/upload", upload.single("file"), async (req, res) => {
  const file = req.file;
  const fileId = file.filename;
  let preview = "";
  let base64 = "";

  try {
    const ext = file.originalname.toLowerCase();

    if (ext.endsWith(".csv")) {
      const content = fs.readFileSync(file.path, "utf8");
      const parsed = Papa.parse(content, { header: true });
      fileStore[fileId] = parsed.data;
      preview = JSON.stringify(parsed.data.slice(0, 5), null, 2);
    } else if (ext.endsWith(".xlsx")) {
      const workbook = xlsx.readFile(file.path);
      const sheetName = workbook.SheetNames[0];
      const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
      fileStore[fileId] = data;
      preview = JSON.stringify(data.slice(0, 5), null, 2);
    } else if (ext.endsWith(".txt")) {
      const content = fs.readFileSync(file.path, "utf8");
      fileStore[fileId] = content;
      preview = content.slice(0, 500);
    } else if (ext.endsWith(".pdf")) {
      const dataBuffer = fs.readFileSync(file.path);
      const pdfData = await pdfParse(dataBuffer);
      fileStore[fileId] = pdfData.text;               
      preview = pdfData.text.slice(0, 500);           
      base64 = dataBuffer.toString("base64");         
    } else {
      return res.status(400).json({ error: "Unsupported file format." });
    }

    res.json({ fileId, preview, base64 });

  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Failed to process file." });
  }
});



app.post("/query", async (req, res) => {
  const { fileId, question } = req.body;

  const fileData = fileStore[fileId];
  if (!fileData) {
    return res.status(404).json({ error: "File not found." });
  }

  let content = "";

  // Extract clean content from stored file
  if (typeof fileData === "string") {
    // For .txt or parsed .pdf content
    content = fileData.slice(0, 5000); // keep it concise for prompt
  } else if (Array.isArray(fileData)) {
    // For CSV/Excel (structured)
    content = JSON.stringify(fileData.slice(0, 20));
  } else {
    content = "Unsupported file content.";
  }

  // Construct Groq prompt
  const prompt = `
You are an AI assistant helping analyze uploaded documents. Use the provided content to answer the user's question.

Question:
${question}

Document Content:
${content}
`;

  try {
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3-70b-8192",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7
      })
    });

    const result = await groqResponse.json();
    console.log("Groq API result:", JSON.stringify(result, null, 2));

    const responseText = result?.choices?.[0]?.message?.content || "No response from Groq.";
    res.json({ response: responseText });

  } catch (err) {
    console.error("Groq API request failed:", err);
    res.status(500).json({ error: "Groq API request failed." });
  }
});



app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
