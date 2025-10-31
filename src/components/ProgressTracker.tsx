import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { ConversionStatus } from '../types';

interface ProgressTrackerProps {
  status: ConversionStatus;
  currentSlide: number;
  totalSlides: number;
  message: string;
  error?: string;
}

export function ProgressTracker({ status, currentSlide, totalSlides, message, error }: ProgressTrackerProps) {
  const percentage = totalSlides > 0 ? Math.round((currentSlide / totalSlides) * 100) : 0;

  const getStatusColor = () => {
    if (error || status === 'failed') return 'text-red-600';
    if (status === 'completed') return 'text-green-600';
    return 'text-blue-600';
  };

  const getStatusIcon = () => {
    if (error || status === 'failed') {
      return <AlertCircle className="w-8 h-8 text-red-600" />;
    }
    if (status === 'completed') {
      return <CheckCircle className="w-8 h-8 text-green-600" />;
    }
    return <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />;
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8">
      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center justify-center">
          {getStatusIcon()}
        </div>

        <div className="w-full">
          <div className="flex justify-between items-center mb-2">
            <span className={`text-lg font-semibold ${getStatusColor()}`}>
              {status === 'uploading' && 'Uploading File'}
              {status === 'parsing' && 'Parsing Presentation'}
              {status === 'analyzing' && 'AI Analysis'}
              {status === 'generating' && 'Generating Output'}
              {status === 'completed' && 'Conversion Complete'}
              {status === 'failed' && 'Conversion Failed'}
            </span>
            {totalSlides > 0 && status === 'analyzing' && (
              <span className="text-sm text-black">
                Slide {currentSlide} of {totalSlides}
              </span>
            )}
          </div>

          {status !== 'completed' && status !== 'failed' && (
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 ease-out"
                style={{ width: `${percentage}%` }}
              />
            </div>
          )}

          <p className="text-black mt-4 text-center">{message}</p>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
