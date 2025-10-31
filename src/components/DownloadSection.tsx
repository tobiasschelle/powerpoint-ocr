import { Download, RefreshCw, FileText, Image } from 'lucide-react';

interface DownloadSectionProps {
  filename: string;
  onDownloadClean: () => void;
  onDownloadAnnotated: () => void;
  onReset: () => void;
}

export function DownloadSection({ filename, onDownloadClean, onDownloadAnnotated, onReset }: DownloadSectionProps) {
  const cleanFilename = filename.replace(/\.(pptx|ppt)$/i, '_clean.pptx');
  const annotatedFilename = filename.replace(/\.(pptx|ppt)$/i, '_annotated.pptx');

  return (
    <div className="w-full max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8">
      <div className="flex flex-col items-center gap-6">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
          <Download className="w-8 h-8 text-green-600" />
        </div>

        <div className="text-center">
          <h3 className="text-2xl font-bold text-gray-800 mb-2">
            Conversion Complete!
          </h3>
          <p className="text-gray-600 mb-1">
            Your presentation has been converted to editable formats.
          </p>
          <p className="text-sm text-gray-500">
            Choose which version to download
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={onDownloadClean}
            className="flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-lg transition-colors text-left"
          >
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="font-bold">Clean Version</div>
              <div className="text-sm text-blue-100">Editable text only, no background images</div>
            </div>
            <Download className="w-5 h-5 flex-shrink-0" />
          </button>

          <button
            onClick={onDownloadAnnotated}
            className="flex items-center gap-3 bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-6 rounded-lg transition-colors text-left"
          >
            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Image className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="font-bold">Annotated Version</div>
              <div className="text-sm text-green-100">Original images with text overlays for designers</div>
            </div>
            <Download className="w-5 h-5 flex-shrink-0" />
          </button>

          <button
            onClick={onReset}
            className="flex items-center justify-center gap-2 bg-gray-200 hover:bg-gray-300 text-black font-semibold py-3 px-6 rounded-lg transition-colors mt-2"
          >
            <RefreshCw className="w-5 h-5" />
            Convert Another
          </button>
        </div>
      </div>
    </div>
  );
}
