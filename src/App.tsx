import { useState, useCallback } from 'react';
import { FileType } from 'lucide-react';
import { FileUpload } from './components/FileUpload';
import { ProgressTracker } from './components/ProgressTracker';
import { DownloadSection } from './components/DownloadSection';
import { Settings } from './components/Settings';
import { createConversion, processConversion, generateSessionId } from './lib/conversion-service';
import { downloadBlob } from './lib/pptx-generator';
import { ConversionStatus } from './types';
import { getDetectionSettings, saveDetectionSettings } from './lib/settings-service';

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ConversionStatus>('uploading');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [totalSlides, setTotalSlides] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [cleanBlob, setCleanBlob] = useState<Blob | null>(null);
  const [annotatedBlob, setAnnotatedBlob] = useState<Blob | null>(null);
  const [sessionId] = useState(() => generateSessionId());

  const [settings, setSettings] = useState(() => getDetectionSettings());

  const handleHybridToggle = useCallback((enabled: boolean) => {
    const newSettings = { ...settings, useHybridDetection: enabled };
    if (!enabled) {
      newSettings.useCraftPrimary = false;
    }
    setSettings(newSettings);
    saveDetectionSettings(newSettings);
  }, [settings]);

  const handleCraftPrimaryToggle = useCallback((enabled: boolean) => {
    const newSettings = { ...settings, useCraftPrimary: enabled };
    setSettings(newSettings);
    saveDetectionSettings(newSettings);
  }, [settings]);

  const handleDBNetToggle = useCallback((enabled: boolean) => {
    const newSettings = { ...settings, useDBNet: enabled };
    setSettings(newSettings);
    saveDetectionSettings(newSettings);
  }, [settings]);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setError(undefined);
    setCleanBlob(null);
    setAnnotatedBlob(null);
    setStatus('uploading');
    setMessage('Preparing to convert...');

    try {
      const conversion = await createConversion(selectedFile.name, sessionId);

      const { cleanBlob: clean, annotatedBlob: annotated } = await processConversion(
        selectedFile,
        conversion.id,
        (stage, current, total, msg) => {
          setStatus(stage);
          setCurrentSlide(current);
          setTotalSlides(total);
          setMessage(msg);
        }
      );

      setCleanBlob(clean);
      setAnnotatedBlob(annotated);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      setStatus('failed');
      setMessage('Conversion failed. Please try again.');
    }
  }, [sessionId]);

  const handleDownloadClean = useCallback(() => {
    if (cleanBlob && file) {
      const outputFilename = file.name.replace(/\.(pptx|ppt)$/i, '_clean.pptx');
      downloadBlob(cleanBlob, outputFilename);
    }
  }, [cleanBlob, file]);

  const handleDownloadAnnotated = useCallback(() => {
    if (annotatedBlob && file) {
      const outputFilename = file.name.replace(/\.(pptx|ppt)$/i, '_annotated.pptx');
      downloadBlob(annotatedBlob, outputFilename);
    }
  }, [annotatedBlob, file]);

  const handleReset = useCallback(() => {
    setFile(null);
    setStatus('uploading');
    setCurrentSlide(0);
    setTotalSlides(0);
    setMessage('');
    setError(undefined);
    setCleanBlob(null);
    setAnnotatedBlob(null);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Settings
        useHybridDetection={settings.useHybridDetection}
        useCraftPrimary={settings.useCraftPrimary}
        useDBNet={settings.useDBNet}
        onHybridToggle={handleHybridToggle}
        onCraftPrimaryToggle={handleCraftPrimaryToggle}
        onDBNetToggle={handleDBNetToggle}
      />
      <div className="container mx-auto px-4 py-12">
        <header className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-blue-600 rounded-xl">
              <FileType className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-black">
              AI-Powered PPTX Converter
            </h1>
          </div>
          <p className="text-lg text-black max-w-2xl mx-auto">
            Transform image-based presentations into editable PowerPoint files with accurate text extraction.
            Upload your PPTX and let AI analyze and recreate text elements and tables.
          </p>
        </header>

        <main className="max-w-4xl mx-auto">
          {!file && (
            <FileUpload onFileSelect={handleFileSelect} />
          )}

          {file && status !== 'completed' && (
            <ProgressTracker
              status={status}
              currentSlide={currentSlide}
              totalSlides={totalSlides}
              message={message}
              error={error}
            />
          )}

          {file && status === 'completed' && cleanBlob && annotatedBlob && (
            <DownloadSection
              filename={file.name}
              onDownloadClean={handleDownloadClean}
              onDownloadAnnotated={handleDownloadAnnotated}
              onReset={handleReset}
            />
          )}

          {error && status === 'failed' && (
            <div className="mt-6 text-center">
              <button
                onClick={handleReset}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </main>

        <footer className="mt-16 text-center text-black text-sm">
          <p>Powered by Claude AI Vision and PptxGenJS</p>
          <p className="mt-2">AI-powered text extraction creates native editable text and tables</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
