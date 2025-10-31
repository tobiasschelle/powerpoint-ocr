import { useCallback, useState } from 'react';
import { Upload, FileType } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export function FileUpload({ onFileSelect, disabled }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    const pptxFile = files.find(file =>
      file.name.endsWith('.pptx') || file.name.endsWith('.ppt')
    );

    if (pptxFile) {
      onFileSelect(pptxFile);
    }
  }, [onFileSelect, disabled]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      onFileSelect(files[0]);
    }
  }, [onFileSelect]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative border-2 border-dashed rounded-xl p-12 text-center transition-all
        ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400 cursor-pointer'}
      `}
    >
      <input
        type="file"
        accept=".pptx,.ppt"
        onChange={handleFileInput}
        disabled={disabled}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        id="file-upload"
      />

      <div className="flex flex-col items-center gap-4">
        <div className="p-4 bg-blue-100 rounded-full">
          {isDragging ? (
            <FileType className="w-12 h-12 text-blue-600" />
          ) : (
            <Upload className="w-12 h-12 text-blue-600" />
          )}
        </div>

        <div>
          <h3 className="text-xl font-semibold text-black mb-2">
            {isDragging ? 'Drop your PPTX file here' : 'Upload PowerPoint Presentation'}
          </h3>
          <p className="text-black">
            Drag and drop your PPTX file here, or click to browse
          </p>
          <p className="text-sm text-black mt-2">
            Supports .pptx and .ppt files
          </p>
        </div>
      </div>
    </div>
  );
}
