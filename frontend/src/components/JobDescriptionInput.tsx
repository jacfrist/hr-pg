import { useRef, useState } from 'react';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface JobDescriptionInputProps {
  value: string;
  onChange: (value: string) => void;
  onError?: (message: string) => void;
}

function JobDescriptionInput({
  value,
  onChange,
  onError,
}: JobDescriptionInputProps) {
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setError = (message: string) => {
    if (onError) onError(message);
  };

  const extractTextFromPdf = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');

      fullText += `${pageText}\n`;
    }

    return fullText.trim();
  };

  const extractTextFromDocx = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim();
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith('.txt')) {
      return (await file.text()).trim();
    }

    if (lowerName.endsWith('.pdf')) {
      return await extractTextFromPdf(file);
    }

    if (lowerName.endsWith('.docx')) {
      return await extractTextFromDocx(file);
    }

    throw new Error('Unsupported file type. Please upload a .txt, .pdf, or .docx file.');
  };

  const handleFile = async (file: File) => {
    setError('');
    setUploadingFile(true);

    try {
      const extractedText = await extractTextFromFile(file);

      if (!extractedText.trim()) {
        throw new Error('Could not extract any text from that file.');
      }

      onChange(extractedText);
      setUploadedFileName(file.name);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to read file.';
      setError(message);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await handleFile(file);
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    await handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };

  return (
    <div className="mb-8 max-w-3xl mx-auto retro-panel">
      <label htmlFor="jobDescription" className="block text-cyan-200 text-sm mb-2">
        Paste the job description you are interviewing for, or upload a file
      </label>

      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.pdf,.docx"
        className="hidden"
        onChange={handleFileInputChange}
      />

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        className="mb-3 p-4 rounded-lg border-2 text-center transition-all duration-150 cursor-pointer"
        style={{
          backgroundColor: 'var(--retro-panel)',
          borderColor: isDraggingFile ? 'var(--retro-accent)' : 'var(--retro-border)',
          boxShadow: isDraggingFile ? '0 0 12px var(--retro-accent)' : 'none',
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <p className="text-cyan-200 text-sm mb-2">
          Drag and drop a file here, or click to upload
        </p>
        <p className="text-cyan-400 text-xs mb-3">
          Supported file types: .txt, .pdf, .docx
        </p>

        <button
          type="button"
          disabled={uploadingFile}
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          className="px-4 py-2 rounded text-white text-sm font-semibold border-2 transition-all duration-150"
          style={{
            background: 'linear-gradient(180deg, #3b3f6d, #272b55)',
            borderColor: 'var(--retro-border)',
            boxShadow: '0 0 8px var(--retro-border)',
          }}
        >
          {uploadingFile ? 'Reading file...' : 'Choose File'}
        </button>

        {uploadedFileName && (
          <p className="text-xs text-cyan-300 mt-3">
            Loaded file: <span className="text-white">{uploadedFileName}</span>
          </p>
        )}
      </div>

      <textarea
        id="jobDescription"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-36 p-3 rounded-lg text-white placeholder-cyan-400"
        style={{
          backgroundColor: 'var(--retro-panel)',
          border: '2px solid var(--retro-border)',
          boxShadow: 'inset 0 0 0 2px var(--retro-border-dark)',
        }}
        onFocus={(e) => {
          e.target.style.borderColor = 'var(--retro-accent)';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = 'var(--retro-border)';
        }}
        placeholder="Paste responsibilities, requirements, and preferred qualifications..."
      />

      <p className="text-xs text-cyan-300 mt-2">
        You can paste text directly, drag and drop a file, or click to upload from your computer.
      </p>
      <p className="text-xs text-cyan-300 mt-1">
        Questions will be generated based on this posting while still matching your selected role and difficulty.
      </p>
    </div>
  );
}

export default JobDescriptionInput;